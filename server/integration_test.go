package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/coder/websocket"
)

// testServer starts an httptest server with a fresh room and returns it.
func testServer(t *testing.T) (*httptest.Server, *Room) {
	t.Helper()
	room := NewRoom()
	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(w, r, room)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv, room
}

// connectClient connects a WebSocket client to the test server.
func connectClient(t *testing.T, srv *httptest.Server, name string) *websocket.Conn {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	url := "ws" + srv.URL[4:] + "/ws?name=" + name
	conn, _, err := websocket.Dial(ctx, url, nil)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	return conn
}

// readMsg reads one ServerMessage from the connection.
func readMsg(t *testing.T, conn *websocket.Conn) ServerMessage {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, data, err := conn.Read(ctx)
	if err != nil {
		t.Fatalf("failed to read message: %v", err)
	}

	var msg ServerMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		t.Fatalf("failed to unmarshal message: %v", err)
	}
	return msg
}

// writeMsg writes a ClientMessage to the connection.
func writeMsg(t *testing.T, conn *websocket.Conn, cm ClientMessage) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	data, err := json.Marshal(cm)
	if err != nil {
		t.Fatalf("failed to marshal client message: %v", err)
	}
	if err := conn.Write(ctx, websocket.MessageText, data); err != nil {
		t.Fatalf("failed to write message: %v", err)
	}
}

func TestIntegrationConnectAndWelcome(t *testing.T) {
	srv, _ := testServer(t)

	conn := connectClient(t, srv, "Alice")

	// Should receive WELCOME
	welcome := readMsg(t, conn)
	if welcome.Msg != MsgWelcome {
		t.Fatalf("expected WELCOME, got %s", welcome.Msg)
	}
	if welcome.PlayerName != "Alice" {
		t.Errorf("expected playerName Alice, got %s", welcome.PlayerName)
	}
	if welcome.PlayerID == "" {
		t.Error("expected non-empty playerId")
	}

	// Should receive STATE_SYNC
	sync := readMsg(t, conn)
	if sync.Msg != MsgStateSync {
		t.Fatalf("expected STATE_SYNC, got %s", sync.Msg)
	}
	if sync.State == nil {
		t.Error("expected non-nil state in STATE_SYNC")
	}

	// Should receive PLAYER_JOINED (broadcast includes self)
	joined := readMsg(t, conn)
	if joined.Msg != MsgPlayerJoined {
		t.Fatalf("expected PLAYER_JOINED, got %s", joined.Msg)
	}
}

func TestIntegrationTwoPlayers(t *testing.T) {
	srv, _ := testServer(t)

	// Connect Alice
	alice := connectClient(t, srv, "Alice")
	readMsg(t, alice) // WELCOME
	readMsg(t, alice) // STATE_SYNC
	readMsg(t, alice) // PLAYER_JOINED (self)

	// Connect Bob
	bob := connectClient(t, srv, "Bob")
	bobWelcome := readMsg(t, bob) // WELCOME
	readMsg(t, bob)                // STATE_SYNC
	readMsg(t, bob)                // PLAYER_JOINED (self)

	// Alice should receive PLAYER_JOINED for Bob
	aliceBobJoin := readMsg(t, alice)
	if aliceBobJoin.Msg != MsgPlayerJoined {
		t.Fatalf("expected PLAYER_JOINED, got %s", aliceBobJoin.Msg)
	}
	if aliceBobJoin.PlayerName != "Bob" {
		t.Errorf("expected Bob, got %s", aliceBobJoin.PlayerName)
	}

	_ = bobWelcome
}

func TestIntegrationActionBroadcast(t *testing.T) {
	srv, _ := testServer(t)

	// Connect two players
	alice := connectClient(t, srv, "Alice")
	readMsg(t, alice) // WELCOME
	readMsg(t, alice) // STATE_SYNC
	readMsg(t, alice) // PLAYER_JOINED

	bob := connectClient(t, srv, "Bob")
	readMsg(t, bob) // WELCOME
	readMsg(t, bob) // STATE_SYNC
	readMsg(t, bob) // PLAYER_JOINED

	readMsg(t, alice) // PLAYER_JOINED (Bob)

	// Alice sets her life to 15
	payload, _ := json.Marshal(SetPlayerLifePayload{Life: 15})
	writeMsg(t, alice, ClientMessage{
		Msg: MsgAction,
		Action: &Action{
			Type:    ActionSetPlayerLife,
			Payload: payload,
		},
	})

	// Both should receive ACTION_RESULT
	aliceResult := readMsg(t, alice)
	if aliceResult.Msg != MsgActionResult {
		t.Fatalf("alice: expected ACTION_RESULT, got %s", aliceResult.Msg)
	}
	if aliceResult.Action.Seq != 1 {
		t.Errorf("expected seq 1, got %d", aliceResult.Action.Seq)
	}

	bobResult := readMsg(t, bob)
	if bobResult.Msg != MsgActionResult {
		t.Fatalf("bob: expected ACTION_RESULT, got %s", bobResult.Msg)
	}
	if bobResult.Action.Seq != 1 {
		t.Errorf("expected seq 1, got %d", bobResult.Action.Seq)
	}
}

func TestIntegrationUndoFlow(t *testing.T) {
	srv, _ := testServer(t)

	alice := connectClient(t, srv, "Alice")
	readMsg(t, alice) // WELCOME
	readMsg(t, alice) // STATE_SYNC
	readMsg(t, alice) // PLAYER_JOINED

	// Set life to 10
	payload, _ := json.Marshal(SetPlayerLifePayload{Life: 10})
	writeMsg(t, alice, ClientMessage{
		Msg: MsgAction,
		Action: &Action{
			Type:    ActionSetPlayerLife,
			Payload: payload,
		},
	})

	result := readMsg(t, alice)
	if result.Msg != MsgActionResult {
		t.Fatalf("expected ACTION_RESULT, got %s", result.Msg)
	}
	seq := result.Action.Seq

	// Undo the action
	writeMsg(t, alice, ClientMessage{
		Msg: MsgUndo,
		Seq: seq,
	})

	undoResult := readMsg(t, alice)
	if undoResult.Msg != MsgActionResult {
		t.Fatalf("expected ACTION_RESULT for undo, got %s", undoResult.Msg)
	}

	// The undo action should restore life to 20
	var undoPayload SetPlayerLifePayload
	json.Unmarshal(undoResult.Action.Payload, &undoPayload)
	if undoPayload.Life != 20 {
		t.Errorf("expected undo to set life back to 20, got %d", undoPayload.Life)
	}
}

func TestIntegrationPingPong(t *testing.T) {
	srv, _ := testServer(t)

	conn := connectClient(t, srv, "Alice")
	readMsg(t, conn) // WELCOME
	readMsg(t, conn) // STATE_SYNC
	readMsg(t, conn) // PLAYER_JOINED

	writeMsg(t, conn, ClientMessage{Msg: MsgPing})

	pong := readMsg(t, conn)
	if pong.Msg != MsgPong {
		t.Fatalf("expected PONG, got %s", pong.Msg)
	}
}

func TestIntegrationDisconnect(t *testing.T) {
	srv, room := testServer(t)

	// Connect Alice
	alice := connectClient(t, srv, "Alice")
	welcome := readMsg(t, alice) // WELCOME
	readMsg(t, alice)             // STATE_SYNC
	readMsg(t, alice)             // PLAYER_JOINED

	playerID := welcome.PlayerID

	// Connect Bob
	bob := connectClient(t, srv, "Bob")
	readMsg(t, bob) // WELCOME
	readMsg(t, bob) // STATE_SYNC
	readMsg(t, bob) // PLAYER_JOINED

	readMsg(t, alice) // PLAYER_JOINED (Bob)

	// Alice disconnects
	alice.Close(websocket.StatusNormalClosure, "bye")

	// Bob should receive PLAYER_LEFT
	left := readMsg(t, bob)
	if left.Msg != MsgPlayerLeft {
		t.Fatalf("expected PLAYER_LEFT, got %s", left.Msg)
	}
	if left.PlayerID != playerID {
		t.Errorf("expected playerId %s, got %s", playerID, left.PlayerID)
	}

	// Player should be marked disconnected in state
	// Give a moment for the server to process
	time.Sleep(100 * time.Millisecond)
	room.mu.RLock()
	player := room.State.Players[playerID]
	room.mu.RUnlock()
	if player == nil {
		t.Fatal("expected player to still exist in state")
	}
	if player.Connected {
		t.Error("expected player to be disconnected")
	}
}

func TestIntegrationReconnect(t *testing.T) {
	srv, room := testServer(t)

	// Connect Alice
	alice := connectClient(t, srv, "Alice")
	welcome := readMsg(t, alice)
	readMsg(t, alice) // STATE_SYNC
	readMsg(t, alice) // PLAYER_JOINED

	origID := welcome.PlayerID

	// Perform an action so state has content
	payload, _ := json.Marshal(SetPlayerLifePayload{Life: 15})
	writeMsg(t, alice, ClientMessage{
		Msg: MsgAction,
		Action: &Action{
			Type:    ActionSetPlayerLife,
			Payload: payload,
		},
	})
	readMsg(t, alice) // ACTION_RESULT

	// Alice disconnects
	alice.Close(websocket.StatusNormalClosure, "bye")
	time.Sleep(200 * time.Millisecond)

	// Verify disconnected
	room.mu.RLock()
	p := room.State.Players[origID]
	room.mu.RUnlock()
	if p.Connected {
		t.Error("expected player to be disconnected before reconnect")
	}

	// Alice reconnects with same name
	alice2 := connectClient(t, srv, "Alice")
	welcome2 := readMsg(t, alice2)
	if welcome2.PlayerID != origID {
		t.Errorf("expected same playerId on reconnect: want %s, got %s", origID, welcome2.PlayerID)
	}

	stateSync := readMsg(t, alice2)
	if stateSync.State == nil {
		t.Fatal("expected state in STATE_SYNC")
	}
	// Life should be 15 from before disconnect
	if stateSync.State.Players[origID].Life != 15 {
		t.Errorf("expected life 15 on reconnect, got %d", stateSync.State.Players[origID].Life)
	}
}

func TestIntegrationErrorOnInvalidAction(t *testing.T) {
	srv, _ := testServer(t)

	conn := connectClient(t, srv, "Alice")
	readMsg(t, conn) // WELCOME
	readMsg(t, conn) // STATE_SYNC
	readMsg(t, conn) // PLAYER_JOINED

	// Send an action with a nonexistent card
	payload, _ := json.Marshal(RemoveCardPayload{InstanceID: "nonexistent"})
	writeMsg(t, conn, ClientMessage{
		Msg: MsgAction,
		Action: &Action{
			Type:    ActionRemoveCard,
			Payload: payload,
		},
	})

	errMsg := readMsg(t, conn)
	if errMsg.Msg != MsgError {
		t.Fatalf("expected ERROR, got %s", errMsg.Msg)
	}
	if errMsg.Error == "" {
		t.Error("expected non-empty error message")
	}
}
