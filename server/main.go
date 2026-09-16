package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/asturur/collectible-card-gaming/server/internal/idgen"
	"github.com/coder/websocket"
)

func main() {
	port := flag.Int("port", 8080, "port to listen on")
	clientPort := flag.Int("client-port", 5173, "Vite dev client port to tunnel (0 to skip)")
	tunnel := flag.String("tunnel", "", "tunnel mode: cloudflare, none (empty = interactive prompt)")
	flag.Parse()

	room := NewRoom()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(w, r, room)
	})

	addr := fmt.Sprintf(":%d", *port)

	// Start HTTP server in a goroutine so it's ready when the tunnel connects
	server := &http.Server{Addr: addr, Handler: mux}
	go func() {
		slog.Info("starting ZAFF game server", "addr", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	// Give the server a moment to bind the port
	time.Sleep(100 * time.Millisecond)

	fmt.Printf("ZAFF Game Server started on port %d\n", *port)

	// Determine tunnel mode
	tunnelMode := *tunnel
	if tunnelMode == "" {
		tunnelMode = promptTunnelChoice()
	}

	var tunnels []*TunnelResult

	switch tunnelMode {
	case "cloudflare":
		// Start server tunnel
		serverCh := make(chan TunnelResult, 1)
		startCloudflareTunnel(*port, "server", serverCh)

		// Start client tunnel if port is set
		var clientCh chan TunnelResult
		if *clientPort > 0 {
			clientCh = make(chan TunnelResult, 1)
			startCloudflareTunnel(*clientPort, "client", clientCh)
		}

		// Wait for server tunnel
		serverResult := <-serverCh
		tunnels = append(tunnels, &serverResult)

		// Wait for client tunnel
		var clientURL string
		if clientCh != nil {
			clientResult := <-clientCh
			tunnels = append(tunnels, &clientResult)
			clientURL = clientResult.URL
		}

		printConnectionBox(serverResult.URL, clientURL, *port, *clientPort)

	case "none":
		printConnectionBox("", "", *port, *clientPort)

	default:
		fmt.Printf("Unknown tunnel mode %q, using no tunnel.\n", tunnelMode)
		printConnectionBox("", "", *port, *clientPort)
	}

	// Wait for SIGINT or SIGTERM for graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	fmt.Println("\nShutting down...")

	// Kill cloudflared subprocesses
	for _, t := range tunnels {
		if t != nil && t.Cmd != nil && t.Cmd.Process != nil {
			slog.Info("stopping cloudflare tunnel")
			_ = t.Cmd.Process.Kill()
			_, _ = t.Cmd.Process.Wait()
		}
	}

	// Gracefully shut down the HTTP server
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}

	fmt.Println("Server stopped.")
}

func handleWebSocket(w http.ResponseWriter, r *http.Request, room *Room) {
	name := r.URL.Query().Get("name")
	if name == "" {
		name = "Anonymous"
	}

	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		OriginPatterns: []string{"*"},
	})
	if err != nil {
		slog.Error("websocket accept failed", "error", err)
		return
	}
	defer conn.CloseNow()

	playerID := idgen.New()

	client := &Client{
		Conn:       conn,
		PlayerID:   playerID,
		PlayerName: name,
		Room:       room,
	}

	// Add to room (may reassign playerID on reconnect)
	actualID := room.AddClient(client)
	client.PlayerID = actualID

	// Send WELCOME
	client.SendMsg(ServerMessage{
		Msg:        MsgWelcome,
		PlayerID:   actualID,
		PlayerName: name,
	})

	// Send STATE_SYNC
	client.SendMsg(room.GetStateSync())

	// Broadcast PLAYER_JOINED to others
	room.BroadcastPlayerJoined(actualID, name)

	// Read loop — blocks until disconnect
	ctx := r.Context()
	client.ReadLoop(ctx)

	// Clean up on disconnect
	room.RemoveClient(actualID)
	conn.Close(websocket.StatusNormalClosure, "")
}
