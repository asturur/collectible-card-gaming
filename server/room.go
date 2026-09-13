package main

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// Room holds all state for a game session.
type Room struct {
	State      *GameState
	ActionLog  []SequencedAction
	Clients    map[string]*Client
	SeqCounter uint64
	mu         sync.RWMutex
}

// NewRoom creates a room with an empty game state.
func NewRoom() *Room {
	gs := NewGameState()
	// Initialize shared zone
	gs.Zones["shared:stack"] = []string{}
	return &Room{
		State:   gs,
		Clients: make(map[string]*Client),
	}
}

// ProcessAction reduces an action, stores it in the log, and broadcasts.
func (r *Room) ProcessAction(action Action, playerID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	undo, err := Reduce(r.State, action, playerID)
	if err != nil {
		return err
	}

	r.SeqCounter++
	sa := SequencedAction{
		Type:      action.Type,
		Payload:   action.Payload,
		Seq:       r.SeqCounter,
		PlayerID:  playerID,
		Timestamp: time.Now().UnixMilli(),
		Undo:      undo,
	}

	r.ActionLog = append(r.ActionLog, sa)

	msg := ServerMessage{
		Msg:    MsgActionResult,
		Action: &sa,
	}

	r.broadcast(msg)
	return nil
}

// ProcessUndo looks up an action by seq number and applies its inverse.
func (r *Room) ProcessUndo(seq uint64, playerID string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Find the action in the log
	var found *SequencedAction
	for i := range r.ActionLog {
		if r.ActionLog[i].Seq == seq {
			found = &r.ActionLog[i]
			break
		}
	}

	if found == nil {
		return fmt.Errorf("action with seq %d not found", seq)
	}

	if found.Undo == nil {
		return fmt.Errorf("action with seq %d has no undo", seq)
	}

	undoAction := *found.Undo

	undo, err := Reduce(r.State, undoAction, playerID)
	if err != nil {
		return fmt.Errorf("undo of seq %d failed: %w", seq, err)
	}

	r.SeqCounter++
	sa := SequencedAction{
		Type:      undoAction.Type,
		Payload:   undoAction.Payload,
		Seq:       r.SeqCounter,
		PlayerID:  playerID,
		Timestamp: time.Now().UnixMilli(),
		Undo:      undo,
	}

	r.ActionLog = append(r.ActionLog, sa)

	msg := ServerMessage{
		Msg:    MsgActionResult,
		Action: &sa,
	}

	r.broadcast(msg)
	return nil
}

// AddClient registers a client in the room and updates game state.
// It returns the playerID to use (reused if a player with the same name
// was previously connected).
func (r *Room) AddClient(client *Client) string {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Check for reconnection by name
	for id, p := range r.State.Players {
		if p.Name == client.PlayerName && !p.Connected {
			p.Connected = true
			client.PlayerID = id
			r.Clients[id] = client
			slog.Info("player reconnected", "playerId", id, "name", client.PlayerName)
			return id
		}
	}

	// New player
	playerID := client.PlayerID
	r.State.Players[playerID] = &Player{
		Name:      client.PlayerName,
		Life:      20,
		Connected: true,
	}
	r.State.EnsurePlayerZones(playerID)
	r.Clients[playerID] = client

	slog.Info("player joined", "playerId", playerID, "name", client.PlayerName)
	return playerID
}

// RemoveClient marks a player as disconnected.
func (r *Room) RemoveClient(playerID string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if p, ok := r.State.Players[playerID]; ok {
		p.Connected = false
	}
	delete(r.Clients, playerID)

	slog.Info("player left", "playerId", playerID)

	msg := ServerMessage{
		Msg:      MsgPlayerLeft,
		PlayerID: playerID,
	}
	r.broadcast(msg)
}

// GetStateSync returns a STATE_SYNC server message (under read lock).
func (r *Room) GetStateSync() ServerMessage {
	r.mu.RLock()
	defer r.mu.RUnlock()

	logCopy := make([]SequencedAction, len(r.ActionLog))
	copy(logCopy, r.ActionLog)

	return ServerMessage{
		Msg:   MsgStateSync,
		State: r.State,
		Log:   logCopy,
	}
}

// BroadcastPlayerJoined notifies all clients about a new player.
func (r *Room) BroadcastPlayerJoined(playerID, playerName string) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	msg := ServerMessage{
		Msg:        MsgPlayerJoined,
		PlayerID:   playerID,
		PlayerName: playerName,
	}
	r.broadcast(msg)
}

// broadcast sends a server message to all connected clients.
// Must be called with the lock held.
func (r *Room) broadcast(msg ServerMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		slog.Error("failed to marshal broadcast message", "error", err)
		return
	}

	for _, client := range r.Clients {
		client.Send(data)
	}
}
