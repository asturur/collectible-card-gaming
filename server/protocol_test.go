package main

import (
	"encoding/json"
	"testing"
)

func TestGameStateMarshal(t *testing.T) {
	gs := NewGameState()
	gs.Players["p1"] = &Player{Name: "Alice", Life: 20, Connected: true}
	gs.Cards["inst-1"] = &Card{
		InstanceID: "inst-1",
		CardID:     "card-100",
		ImageURL:   "https://example.com/card.png",
		OwnerID:    "p1",
		Zone:       "p1:battlefield",
		ZoneIndex:  0,
		X:          100.5,
		Y:          200.0,
		Rotation:   90,
		FaceDown:   false,
		Counters:   map[string]int{"+1/+1": 2},
	}
	gs.Zones["p1:battlefield"] = []string{"inst-1"}

	data, err := json.Marshal(gs)
	if err != nil {
		t.Fatalf("failed to marshal GameState: %v", err)
	}

	var decoded GameState
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal GameState: %v", err)
	}

	if decoded.Players["p1"].Name != "Alice" {
		t.Errorf("expected player name Alice, got %s", decoded.Players["p1"].Name)
	}
	if decoded.Players["p1"].Life != 20 {
		t.Errorf("expected life 20, got %d", decoded.Players["p1"].Life)
	}
	card := decoded.Cards["inst-1"]
	if card == nil {
		t.Fatal("expected card inst-1 to exist")
	}
	if card.X != 100.5 {
		t.Errorf("expected X=100.5, got %f", card.X)
	}
	if card.Counters["+1/+1"] != 2 {
		t.Errorf("expected counter +1/+1 = 2, got %d", card.Counters["+1/+1"])
	}
	if len(decoded.Zones["p1:battlefield"]) != 1 || decoded.Zones["p1:battlefield"][0] != "inst-1" {
		t.Errorf("expected zone p1:battlefield = [inst-1], got %v", decoded.Zones["p1:battlefield"])
	}
}

func TestActionMarshal(t *testing.T) {
	payload, _ := json.Marshal(MoveCardPayload{
		InstanceID: "inst-1",
		ToZone:     "p1:hand",
	})
	action := Action{
		Type:    ActionMoveCard,
		Payload: payload,
	}

	data, err := json.Marshal(action)
	if err != nil {
		t.Fatalf("failed to marshal Action: %v", err)
	}

	var decoded Action
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal Action: %v", err)
	}

	if decoded.Type != ActionMoveCard {
		t.Errorf("expected type MOVE_CARD, got %s", decoded.Type)
	}

	var p MoveCardPayload
	if err := json.Unmarshal(decoded.Payload, &p); err != nil {
		t.Fatalf("failed to unmarshal MoveCardPayload: %v", err)
	}
	if p.InstanceID != "inst-1" {
		t.Errorf("expected instanceId inst-1, got %s", p.InstanceID)
	}
}

func TestSequencedActionMarshal(t *testing.T) {
	payload, _ := json.Marshal(FlipCardPayload{InstanceID: "inst-1"})
	undoPayload, _ := json.Marshal(FlipCardPayload{InstanceID: "inst-1"})

	sa := SequencedAction{
		Type:      ActionFlipCard,
		Payload:   payload,
		Seq:       42,
		PlayerID:  "player-uuid",
		Timestamp: 1700000000000,
		Undo: &Action{
			Type:    ActionFlipCard,
			Payload: undoPayload,
		},
	}

	data, err := json.Marshal(sa)
	if err != nil {
		t.Fatalf("failed to marshal SequencedAction: %v", err)
	}

	var decoded SequencedAction
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal SequencedAction: %v", err)
	}

	if decoded.Seq != 42 {
		t.Errorf("expected seq 42, got %d", decoded.Seq)
	}
	if decoded.PlayerID != "player-uuid" {
		t.Errorf("expected playerId player-uuid, got %s", decoded.PlayerID)
	}
	if decoded.Undo == nil {
		t.Fatal("expected undo to be non-nil")
	}
	if decoded.Undo.Type != ActionFlipCard {
		t.Errorf("expected undo type FLIP_CARD, got %s", decoded.Undo.Type)
	}
}

func TestClientMessageMarshal(t *testing.T) {
	payload, _ := json.Marshal(FlipCardPayload{InstanceID: "inst-1"})
	cm := ClientMessage{
		Msg: MsgAction,
		Action: &Action{
			Type:    ActionFlipCard,
			Payload: payload,
		},
	}

	data, err := json.Marshal(cm)
	if err != nil {
		t.Fatalf("failed to marshal ClientMessage: %v", err)
	}

	var decoded ClientMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal ClientMessage: %v", err)
	}

	if decoded.Msg != MsgAction {
		t.Errorf("expected msg ACTION, got %s", decoded.Msg)
	}
}

func TestServerMessageMarshal(t *testing.T) {
	sm := ServerMessage{
		Msg:        MsgWelcome,
		PlayerID:   "player-uuid",
		PlayerName: "Alice",
	}

	data, err := json.Marshal(sm)
	if err != nil {
		t.Fatalf("failed to marshal ServerMessage: %v", err)
	}

	var decoded ServerMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal ServerMessage: %v", err)
	}

	if decoded.Msg != MsgWelcome {
		t.Errorf("expected msg WELCOME, got %s", decoded.Msg)
	}
	if decoded.PlayerName != "Alice" {
		t.Errorf("expected playerName Alice, got %s", decoded.PlayerName)
	}
}

func TestServerMessageErrorMarshal(t *testing.T) {
	sm := ServerMessage{
		Msg:    MsgError,
		Error:  "card not found",
		RefSeq: 5,
	}

	data, err := json.Marshal(sm)
	if err != nil {
		t.Fatalf("failed to marshal error ServerMessage: %v", err)
	}

	var decoded ServerMessage
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("failed to unmarshal error ServerMessage: %v", err)
	}

	if decoded.Error != "card not found" {
		t.Errorf("expected error 'card not found', got %s", decoded.Error)
	}
	if decoded.RefSeq != 5 {
		t.Errorf("expected refSeq 5, got %d", decoded.RefSeq)
	}
}
