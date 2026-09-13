package main

import (
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"github.com/asturur/collectible-card-gaming/server/internal/idgen"
	"github.com/coder/websocket"
)

func main() {
	port := flag.Int("port", 8080, "port to listen on")
	flag.Parse()

	room := NewRoom()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(w, r, room)
	})

	addr := fmt.Sprintf(":%d", *port)
	slog.Info("starting ZAFF game server", "addr", addr)

	if err := http.ListenAndServe(addr, mux); err != nil {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
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
