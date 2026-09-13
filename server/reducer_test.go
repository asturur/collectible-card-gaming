package main

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/asturur/collectible-card-gaming/server/internal/idgen"
)

// setupTestIDGen installs a deterministic ID generator that produces
// "inst-1", "inst-2", etc. Returns a cleanup function.
func setupTestIDGen() func() {
	counter := 0
	old := idgen.Generator
	idgen.Generator = func() string {
		counter++
		return fmt.Sprintf("inst-%d", counter)
	}
	return func() { idgen.Generator = old }
}

func makeAction(t *testing.T, actionType string, payload any) Action {
	t.Helper()
	raw, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("failed to marshal payload: %v", err)
	}
	return Action{Type: actionType, Payload: raw}
}

// newTestState creates a GameState with one player and their zones initialized.
func newTestState(playerID string) *GameState {
	gs := NewGameState()
	gs.Players[playerID] = &Player{Name: "TestPlayer", Life: 20, Connected: true}
	gs.EnsurePlayerZones(playerID)
	return gs
}

// addTestCard adds a card directly to the state for testing.
func addTestCard(gs *GameState, instanceID, cardID, ownerID, zone string) *Card {
	card := &Card{
		InstanceID: instanceID,
		CardID:     cardID,
		ImageURL:   "https://example.com/" + cardID + ".png",
		OwnerID:    ownerID,
		Zone:       zone,
		ZoneIndex:  len(gs.Zones[zone]),
		Counters:   make(map[string]int),
	}
	gs.Cards[instanceID] = card
	gs.Zones[zone] = append(gs.Zones[zone], instanceID)
	return card
}

func TestReduceAddCard(t *testing.T) {
	cleanup := setupTestIDGen()
	defer cleanup()

	gs := newTestState("p1")
	action := makeAction(t, ActionAddCard, AddCardPayload{
		CardID:   "lightning-bolt",
		ImageURL: "https://example.com/bolt.png",
		Zone:     "p1:battlefield",
		FaceDown: false,
	})

	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Card should exist
	card, ok := gs.Cards["inst-1"]
	if !ok {
		t.Fatal("expected card inst-1 to be created")
	}
	if card.CardID != "lightning-bolt" {
		t.Errorf("expected cardId lightning-bolt, got %s", card.CardID)
	}
	if card.Zone != "p1:battlefield" {
		t.Errorf("expected zone p1:battlefield, got %s", card.Zone)
	}
	if card.OwnerID != "p1" {
		t.Errorf("expected ownerId p1, got %s", card.OwnerID)
	}

	// Zone should contain the card
	if len(gs.Zones["p1:battlefield"]) != 1 || gs.Zones["p1:battlefield"][0] != "inst-1" {
		t.Errorf("expected zone to contain inst-1, got %v", gs.Zones["p1:battlefield"])
	}

	// Undo should be REMOVE_CARD
	if undo.Type != ActionRemoveCard {
		t.Errorf("expected undo type REMOVE_CARD, got %s", undo.Type)
	}
	var undoP RemoveCardPayload
	json.Unmarshal(undo.Payload, &undoP)
	if undoP.InstanceID != "inst-1" {
		t.Errorf("expected undo instanceId inst-1, got %s", undoP.InstanceID)
	}
}

func TestReduceRemoveCard(t *testing.T) {
	gs := newTestState("p1")
	addTestCard(gs, "inst-1", "bolt", "p1", "p1:battlefield")

	action := makeAction(t, ActionRemoveCard, RemoveCardPayload{InstanceID: "inst-1"})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if _, ok := gs.Cards["inst-1"]; ok {
		t.Error("expected card to be removed")
	}
	if len(gs.Zones["p1:battlefield"]) != 0 {
		t.Errorf("expected zone to be empty, got %v", gs.Zones["p1:battlefield"])
	}
	if undo.Type != ActionAddCard {
		t.Errorf("expected undo type ADD_CARD, got %s", undo.Type)
	}
}

func TestReduceRemoveCardNotFound(t *testing.T) {
	gs := newTestState("p1")
	action := makeAction(t, ActionRemoveCard, RemoveCardPayload{InstanceID: "nonexistent"})
	_, err := Reduce(gs, action, "p1")
	if err == nil {
		t.Error("expected error for nonexistent card")
	}
}

func TestReduceMoveCard(t *testing.T) {
	gs := newTestState("p1")
	card := addTestCard(gs, "inst-1", "bolt", "p1", "p1:battlefield")
	card.X = 100
	card.Y = 200

	action := makeAction(t, ActionMoveCard, MoveCardPayload{
		InstanceID: "inst-1",
		ToZone:     "p1:hand",
	})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if card.Zone != "p1:hand" {
		t.Errorf("expected zone p1:hand, got %s", card.Zone)
	}
	// Position should reset on zone change
	if card.X != 0 || card.Y != 0 {
		t.Errorf("expected position (0,0) after zone change, got (%f,%f)", card.X, card.Y)
	}
	if len(gs.Zones["p1:battlefield"]) != 0 {
		t.Error("expected battlefield to be empty")
	}
	if len(gs.Zones["p1:hand"]) != 1 || gs.Zones["p1:hand"][0] != "inst-1" {
		t.Errorf("expected hand to contain inst-1, got %v", gs.Zones["p1:hand"])
	}

	// Undo should move back
	if undo.Type != ActionMoveCard {
		t.Errorf("expected undo type MOVE_CARD, got %s", undo.Type)
	}
	var undoP MoveCardPayload
	json.Unmarshal(undo.Payload, &undoP)
	if undoP.ToZone != "p1:battlefield" {
		t.Errorf("expected undo toZone p1:battlefield, got %s", undoP.ToZone)
	}
}

func TestReduceMoveCardWithIndex(t *testing.T) {
	gs := newTestState("p1")
	addTestCard(gs, "inst-1", "card-a", "p1", "p1:hand")
	addTestCard(gs, "inst-2", "card-b", "p1", "p1:hand")
	addTestCard(gs, "inst-3", "card-c", "p1", "p1:battlefield")

	idx := 1
	action := makeAction(t, ActionMoveCard, MoveCardPayload{
		InstanceID: "inst-3",
		ToZone:     "p1:hand",
		ToIndex:    &idx,
	})
	_, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := []string{"inst-1", "inst-3", "inst-2"}
	if len(gs.Zones["p1:hand"]) != 3 {
		t.Fatalf("expected hand to have 3 cards, got %d", len(gs.Zones["p1:hand"]))
	}
	for i, id := range expected {
		if gs.Zones["p1:hand"][i] != id {
			t.Errorf("expected hand[%d] = %s, got %s", i, id, gs.Zones["p1:hand"][i])
		}
	}
}

func TestReduceSetCardPosition(t *testing.T) {
	gs := newTestState("p1")
	card := addTestCard(gs, "inst-1", "bolt", "p1", "p1:battlefield")
	card.X = 10
	card.Y = 20

	action := makeAction(t, ActionSetCardPosition, SetCardPositionPayload{
		InstanceID: "inst-1",
		X:          300.5,
		Y:          400.0,
	})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if card.X != 300.5 || card.Y != 400.0 {
		t.Errorf("expected (300.5, 400), got (%f, %f)", card.X, card.Y)
	}

	var undoP SetCardPositionPayload
	json.Unmarshal(undo.Payload, &undoP)
	if undoP.X != 10 || undoP.Y != 20 {
		t.Errorf("expected undo position (10, 20), got (%f, %f)", undoP.X, undoP.Y)
	}
}

func TestReduceRotateCard(t *testing.T) {
	gs := newTestState("p1")
	card := addTestCard(gs, "inst-1", "bolt", "p1", "p1:battlefield")
	card.Rotation = 0

	action := makeAction(t, ActionRotateCard, RotateCardPayload{
		InstanceID: "inst-1",
		Angle:      90,
	})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if card.Rotation != 90 {
		t.Errorf("expected rotation 90, got %f", card.Rotation)
	}

	var undoP RotateCardPayload
	json.Unmarshal(undo.Payload, &undoP)
	if undoP.Angle != 0 {
		t.Errorf("expected undo angle 0, got %f", undoP.Angle)
	}
}

func TestReduceFlipCard(t *testing.T) {
	gs := newTestState("p1")
	card := addTestCard(gs, "inst-1", "bolt", "p1", "p1:battlefield")
	card.FaceDown = false

	action := makeAction(t, ActionFlipCard, FlipCardPayload{InstanceID: "inst-1"})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !card.FaceDown {
		t.Error("expected card to be face down after flip")
	}

	// FLIP_CARD is self-inverse
	if undo.Type != ActionFlipCard {
		t.Errorf("expected undo type FLIP_CARD, got %s", undo.Type)
	}

	// Apply undo — should flip back
	_, err = Reduce(gs, *undo, "p1")
	if err != nil {
		t.Fatalf("unexpected error on undo: %v", err)
	}
	if card.FaceDown {
		t.Error("expected card to be face up after undo flip")
	}
}

func TestReduceShuffleZone(t *testing.T) {
	gs := newTestState("p1")
	addTestCard(gs, "inst-1", "card-a", "p1", "p1:deck")
	addTestCard(gs, "inst-2", "card-b", "p1", "p1:deck")
	addTestCard(gs, "inst-3", "card-c", "p1", "p1:deck")

	origOrder := make([]string, len(gs.Zones["p1:deck"]))
	copy(origOrder, gs.Zones["p1:deck"])

	action := makeAction(t, ActionShuffleZone, ShuffleZonePayload{Zone: "p1:deck"})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Undo should be SET_ZONE_ORDER with original order
	if undo.Type != ActionSetZoneOrder {
		t.Errorf("expected undo type SET_ZONE_ORDER, got %s", undo.Type)
	}
	var undoP SetZoneOrderPayload
	json.Unmarshal(undo.Payload, &undoP)
	if len(undoP.Order) != 3 {
		t.Errorf("expected undo order length 3, got %d", len(undoP.Order))
	}
	for i, id := range origOrder {
		if undoP.Order[i] != id {
			t.Errorf("expected undo order[%d] = %s, got %s", i, id, undoP.Order[i])
		}
	}
}

func TestReduceSetZoneOrder(t *testing.T) {
	gs := newTestState("p1")
	addTestCard(gs, "inst-1", "card-a", "p1", "p1:hand")
	addTestCard(gs, "inst-2", "card-b", "p1", "p1:hand")
	addTestCard(gs, "inst-3", "card-c", "p1", "p1:hand")

	newOrder := []string{"inst-3", "inst-1", "inst-2"}
	action := makeAction(t, ActionSetZoneOrder, SetZoneOrderPayload{
		Zone:  "p1:hand",
		Order: newOrder,
	})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	for i, id := range newOrder {
		if gs.Zones["p1:hand"][i] != id {
			t.Errorf("expected hand[%d] = %s, got %s", i, id, gs.Zones["p1:hand"][i])
		}
	}

	// Verify undo restores original order
	if undo.Type != ActionSetZoneOrder {
		t.Errorf("expected undo type SET_ZONE_ORDER, got %s", undo.Type)
	}
	var undoP SetZoneOrderPayload
	json.Unmarshal(undo.Payload, &undoP)
	if undoP.Order[0] != "inst-1" || undoP.Order[1] != "inst-2" || undoP.Order[2] != "inst-3" {
		t.Errorf("expected undo order [inst-1, inst-2, inst-3], got %v", undoP.Order)
	}
}

func TestReduceDrawCard(t *testing.T) {
	gs := newTestState("p1")
	addTestCard(gs, "inst-1", "card-a", "p1", "p1:deck")
	addTestCard(gs, "inst-2", "card-b", "p1", "p1:deck")
	addTestCard(gs, "inst-3", "card-c", "p1", "p1:deck")

	action := makeAction(t, ActionDrawCard, DrawCardPayload{
		FromZone: "p1:deck",
		Count:    2,
	})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Deck should have 1 card remaining
	if len(gs.Zones["p1:deck"]) != 1 {
		t.Errorf("expected deck to have 1 card, got %d", len(gs.Zones["p1:deck"]))
	}
	// Hand should have 2 cards
	if len(gs.Zones["p1:hand"]) != 2 {
		t.Errorf("expected hand to have 2 cards, got %d", len(gs.Zones["p1:hand"]))
	}
	// Cards should have moved from top of deck (inst-3, inst-2)
	if gs.Zones["p1:hand"][0] != "inst-3" || gs.Zones["p1:hand"][1] != "inst-2" {
		t.Errorf("expected hand to contain [inst-3, inst-2], got %v", gs.Zones["p1:hand"])
	}

	// Undo should be RETURN_CARDS
	if undo.Type != "RETURN_CARDS" {
		t.Errorf("expected undo type RETURN_CARDS, got %s", undo.Type)
	}
}

func TestReduceDrawCardDefault(t *testing.T) {
	gs := newTestState("p1")
	addTestCard(gs, "inst-1", "card-a", "p1", "p1:deck")
	addTestCard(gs, "inst-2", "card-b", "p1", "p1:deck")

	action := makeAction(t, ActionDrawCard, DrawCardPayload{
		FromZone: "p1:deck",
	})
	_, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Should draw 1 card by default
	if len(gs.Zones["p1:deck"]) != 1 {
		t.Errorf("expected deck to have 1 card, got %d", len(gs.Zones["p1:deck"]))
	}
	if len(gs.Zones["p1:hand"]) != 1 {
		t.Errorf("expected hand to have 1 card, got %d", len(gs.Zones["p1:hand"]))
	}
}

func TestReduceDrawCardEmptyZone(t *testing.T) {
	gs := newTestState("p1")
	action := makeAction(t, ActionDrawCard, DrawCardPayload{FromZone: "p1:deck"})
	_, err := Reduce(gs, action, "p1")
	if err == nil {
		t.Error("expected error drawing from empty zone")
	}
}

func TestReduceSetCounter(t *testing.T) {
	gs := newTestState("p1")
	addTestCard(gs, "inst-1", "bolt", "p1", "p1:battlefield")

	action := makeAction(t, ActionSetCounter, SetCounterPayload{
		InstanceID: "inst-1",
		Name:       "+1/+1",
		Value:      3,
	})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gs.Cards["inst-1"].Counters["+1/+1"] != 3 {
		t.Errorf("expected counter +1/+1 = 3, got %d", gs.Cards["inst-1"].Counters["+1/+1"])
	}

	var undoP SetCounterPayload
	json.Unmarshal(undo.Payload, &undoP)
	if undoP.Value != 0 {
		t.Errorf("expected undo counter value 0, got %d", undoP.Value)
	}
}

func TestReduceSetPlayerLife(t *testing.T) {
	gs := newTestState("p1")

	action := makeAction(t, ActionSetPlayerLife, SetPlayerLifePayload{Life: 15})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gs.Players["p1"].Life != 15 {
		t.Errorf("expected life 15, got %d", gs.Players["p1"].Life)
	}

	var undoP SetPlayerLifePayload
	json.Unmarshal(undo.Payload, &undoP)
	if undoP.Life != 20 {
		t.Errorf("expected undo life 20, got %d", undoP.Life)
	}
}

func TestReduceLoadDeck(t *testing.T) {
	cleanup := setupTestIDGen()
	defer cleanup()

	gs := newTestState("p1")

	action := makeAction(t, ActionLoadDeck, LoadDeckPayload{
		Cards: []LoadDeckCardEntry{
			{CardID: "bolt", ImageURL: "https://example.com/bolt.png"},
			{CardID: "island", ImageURL: "https://example.com/island.png"},
			{CardID: "forest", ImageURL: "https://example.com/forest.png"},
		},
	})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(gs.Zones["p1:deck"]) != 3 {
		t.Errorf("expected deck to have 3 cards, got %d", len(gs.Zones["p1:deck"]))
	}
	if len(gs.Cards) != 3 {
		t.Errorf("expected 3 cards total, got %d", len(gs.Cards))
	}

	// All cards should be face down
	for _, card := range gs.Cards {
		if !card.FaceDown {
			t.Errorf("expected loaded cards to be face down")
		}
		if card.OwnerID != "p1" {
			t.Errorf("expected owner p1, got %s", card.OwnerID)
		}
	}

	// Undo should be CLEAR_PLAYER_CARDS
	if undo.Type != ActionClearPlayerCards {
		t.Errorf("expected undo type CLEAR_PLAYER_CARDS, got %s", undo.Type)
	}
}

func TestReduceClearPlayerCards(t *testing.T) {
	gs := newTestState("p1")
	addTestCard(gs, "inst-1", "bolt", "p1", "p1:battlefield")
	addTestCard(gs, "inst-2", "island", "p1", "p1:hand")
	addTestCard(gs, "inst-3", "forest", "p1", "p1:deck")

	action := makeAction(t, ActionClearPlayerCards, ClearPlayerCardsPayload{})
	undo, err := Reduce(gs, action, "p1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(gs.Cards) != 0 {
		t.Errorf("expected all cards removed, got %d", len(gs.Cards))
	}
	for _, zone := range PlayerZones {
		key := "p1:" + zone
		if len(gs.Zones[key]) != 0 {
			t.Errorf("expected zone %s to be empty, got %v", key, gs.Zones[key])
		}
	}

	// Undo should be LOAD_DECK
	if undo.Type != ActionLoadDeck {
		t.Errorf("expected undo type LOAD_DECK, got %s", undo.Type)
	}
}

func TestReduceUnknownAction(t *testing.T) {
	gs := newTestState("p1")
	action := makeAction(t, "UNKNOWN_ACTION", map[string]string{"foo": "bar"})
	_, err := Reduce(gs, action, "p1")
	if err == nil {
		t.Error("expected error for unknown action type")
	}
}
