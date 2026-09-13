package main

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"

	"github.com/asturur/collectible-card-gaming/server/internal/idgen"
)

// Reduce applies an action to the game state and returns the computed undo action.
// It mutates state in place. On error, state may be partially mutated — callers
// should treat an error return as a no-op (the room layer discards the change).
func Reduce(state *GameState, action Action, playerID string) (*Action, error) {
	switch action.Type {
	case ActionAddCard:
		return reduceAddCard(state, action.Payload, playerID)
	case ActionRemoveCard:
		return reduceRemoveCard(state, action.Payload)
	case ActionMoveCard:
		return reduceMoveCard(state, action.Payload)
	case ActionSetCardPosition:
		return reduceSetCardPosition(state, action.Payload)
	case ActionRotateCard:
		return reduceRotateCard(state, action.Payload)
	case ActionFlipCard:
		return reduceFlipCard(state, action.Payload)
	case ActionShuffleZone:
		return reduceShuffleZone(state, action.Payload)
	case ActionSetZoneOrder:
		return reduceSetZoneOrder(state, action.Payload)
	case ActionDrawCard:
		return reduceDrawCard(state, action.Payload, playerID)
	case ActionSetCounter:
		return reduceSetCounter(state, action.Payload)
	case ActionSetPlayerLife:
		return reduceSetPlayerLife(state, action.Payload, playerID)
	case ActionLoadDeck:
		return reduceLoadDeck(state, action.Payload, playerID)
	case ActionClearPlayerCards:
		return reduceClearPlayerCards(state, playerID)
	default:
		return nil, fmt.Errorf("unknown action type: %s", action.Type)
	}
}

func reduceAddCard(state *GameState, rawPayload json.RawMessage, playerID string) (*Action, error) {
	var p AddCardPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid ADD_CARD payload: %w", err)
	}

	zone := p.Zone
	if zone == "" {
		zone = playerID + ":battlefield"
	}

	instanceID := idgen.New()
	card := &Card{
		InstanceID: instanceID,
		CardID:     p.CardID,
		ImageURL:   p.ImageURL,
		OwnerID:    playerID,
		Zone:       zone,
		ZoneIndex:  len(state.Zones[zone]),
		FaceDown:   p.FaceDown,
		Counters:   make(map[string]int),
	}

	state.Cards[instanceID] = card
	state.Zones[zone] = append(state.Zones[zone], instanceID)

	undoPayload, _ := json.Marshal(RemoveCardPayload{InstanceID: instanceID})
	return &Action{Type: ActionRemoveCard, Payload: undoPayload}, nil
}

func reduceRemoveCard(state *GameState, rawPayload json.RawMessage) (*Action, error) {
	var p RemoveCardPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid REMOVE_CARD payload: %w", err)
	}

	card, ok := state.Cards[p.InstanceID]
	if !ok {
		return nil, fmt.Errorf("card %s not found", p.InstanceID)
	}

	// Build undo: re-add with full state
	undoPayload, _ := json.Marshal(AddCardPayload{
		CardID:   card.CardID,
		ImageURL: card.ImageURL,
		Zone:     card.Zone,
		FaceDown: card.FaceDown,
	})

	// Remove from zone
	removeFromZone(state, card.Zone, p.InstanceID)
	delete(state.Cards, p.InstanceID)

	return &Action{Type: ActionAddCard, Payload: undoPayload}, nil
}

func reduceMoveCard(state *GameState, rawPayload json.RawMessage) (*Action, error) {
	var p MoveCardPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid MOVE_CARD payload: %w", err)
	}

	card, ok := state.Cards[p.InstanceID]
	if !ok {
		return nil, fmt.Errorf("card %s not found", p.InstanceID)
	}

	prevZone := card.Zone
	prevIndex := zoneIndexOf(state, prevZone, p.InstanceID)

	// Build undo
	undoPayload, _ := json.Marshal(MoveCardPayload{
		InstanceID: p.InstanceID,
		ToZone:     prevZone,
		ToIndex:    &prevIndex,
	})

	// Remove from old zone
	removeFromZone(state, prevZone, p.InstanceID)

	// Add to new zone
	if p.ToIndex != nil && *p.ToIndex >= 0 && *p.ToIndex <= len(state.Zones[p.ToZone]) {
		zone := state.Zones[p.ToZone]
		zone = append(zone, "")
		copy(zone[*p.ToIndex+1:], zone[*p.ToIndex:])
		zone[*p.ToIndex] = p.InstanceID
		state.Zones[p.ToZone] = zone
	} else {
		state.Zones[p.ToZone] = append(state.Zones[p.ToZone], p.InstanceID)
	}

	card.Zone = p.ToZone
	// Reset position when leaving battlefield
	if p.ToZone != prevZone {
		card.X = 0
		card.Y = 0
	}
	updateZoneIndices(state, prevZone)
	updateZoneIndices(state, p.ToZone)

	return &Action{Type: ActionMoveCard, Payload: undoPayload}, nil
}

func reduceSetCardPosition(state *GameState, rawPayload json.RawMessage) (*Action, error) {
	var p SetCardPositionPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid SET_CARD_POSITION payload: %w", err)
	}

	card, ok := state.Cards[p.InstanceID]
	if !ok {
		return nil, fmt.Errorf("card %s not found", p.InstanceID)
	}

	undoPayload, _ := json.Marshal(SetCardPositionPayload{
		InstanceID: p.InstanceID,
		X:          card.X,
		Y:          card.Y,
	})

	card.X = p.X
	card.Y = p.Y

	return &Action{Type: ActionSetCardPosition, Payload: undoPayload}, nil
}

func reduceRotateCard(state *GameState, rawPayload json.RawMessage) (*Action, error) {
	var p RotateCardPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid ROTATE_CARD payload: %w", err)
	}

	card, ok := state.Cards[p.InstanceID]
	if !ok {
		return nil, fmt.Errorf("card %s not found", p.InstanceID)
	}

	undoPayload, _ := json.Marshal(RotateCardPayload{
		InstanceID: p.InstanceID,
		Angle:      card.Rotation,
	})

	card.Rotation = p.Angle

	return &Action{Type: ActionRotateCard, Payload: undoPayload}, nil
}

func reduceFlipCard(state *GameState, rawPayload json.RawMessage) (*Action, error) {
	var p FlipCardPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid FLIP_CARD payload: %w", err)
	}

	card, ok := state.Cards[p.InstanceID]
	if !ok {
		return nil, fmt.Errorf("card %s not found", p.InstanceID)
	}

	// FLIP_CARD is self-inverse
	undoPayload, _ := json.Marshal(FlipCardPayload{InstanceID: p.InstanceID})

	card.FaceDown = !card.FaceDown

	return &Action{Type: ActionFlipCard, Payload: undoPayload}, nil
}

func reduceShuffleZone(state *GameState, rawPayload json.RawMessage) (*Action, error) {
	var p ShuffleZonePayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid SHUFFLE_ZONE payload: %w", err)
	}

	zone, ok := state.Zones[p.Zone]
	if !ok {
		return nil, fmt.Errorf("zone %s not found", p.Zone)
	}

	// Capture current order for undo
	prevOrder := make([]string, len(zone))
	copy(prevOrder, zone)
	undoPayload, _ := json.Marshal(SetZoneOrderPayload{
		Zone:  p.Zone,
		Order: prevOrder,
	})

	// Fisher-Yates shuffle
	rand.Shuffle(len(zone), func(i, j int) {
		zone[i], zone[j] = zone[j], zone[i]
	})
	updateZoneIndices(state, p.Zone)

	return &Action{Type: ActionSetZoneOrder, Payload: undoPayload}, nil
}

func reduceSetZoneOrder(state *GameState, rawPayload json.RawMessage) (*Action, error) {
	var p SetZoneOrderPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid SET_ZONE_ORDER payload: %w", err)
	}

	zone, ok := state.Zones[p.Zone]
	if !ok {
		return nil, fmt.Errorf("zone %s not found", p.Zone)
	}

	// Capture current order for undo
	prevOrder := make([]string, len(zone))
	copy(prevOrder, zone)
	undoPayload, _ := json.Marshal(SetZoneOrderPayload{
		Zone:  p.Zone,
		Order: prevOrder,
	})

	state.Zones[p.Zone] = p.Order
	updateZoneIndices(state, p.Zone)

	return &Action{Type: ActionSetZoneOrder, Payload: undoPayload}, nil
}

func reduceDrawCard(state *GameState, rawPayload json.RawMessage, playerID string) (*Action, error) {
	var p DrawCardPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid DRAW_CARD payload: %w", err)
	}

	count := p.Count
	if count <= 0 {
		count = 1
	}

	zone, ok := state.Zones[p.FromZone]
	if !ok {
		return nil, fmt.Errorf("zone %s not found", p.FromZone)
	}
	if len(zone) == 0 {
		return nil, fmt.Errorf("zone %s is empty", p.FromZone)
	}
	if count > len(zone) {
		count = len(zone)
	}

	handZone := playerID + ":hand"

	// Draw from top of zone (end of slice = top)
	drawn := make([]ReturnCardEntry, count)
	for i := 0; i < count; i++ {
		idx := len(zone) - 1 - i
		instID := zone[idx]
		drawn[i] = ReturnCardEntry{
			InstanceID: instID,
			Index:      idx,
		}
	}

	// Build undo: return cards to their original positions in the source zone
	undoPayload, _ := json.Marshal(ReturnCardsPayload{
		Cards:  drawn,
		ToZone: p.FromZone,
	})

	// Move each drawn card to hand
	for i := count - 1; i >= 0; i-- {
		instID := zone[len(zone)-1]
		zone = zone[:len(zone)-1]
		state.Zones[handZone] = append(state.Zones[handZone], instID)
		if card, ok := state.Cards[instID]; ok {
			card.Zone = handZone
			card.FaceDown = false
			card.X = 0
			card.Y = 0
		}
	}
	state.Zones[p.FromZone] = zone
	updateZoneIndices(state, p.FromZone)
	updateZoneIndices(state, handZone)

	return &Action{Type: "RETURN_CARDS", Payload: undoPayload}, nil
}

func reduceSetCounter(state *GameState, rawPayload json.RawMessage) (*Action, error) {
	var p SetCounterPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid SET_COUNTER payload: %w", err)
	}

	card, ok := state.Cards[p.InstanceID]
	if !ok {
		return nil, fmt.Errorf("card %s not found", p.InstanceID)
	}

	prevValue := card.Counters[p.Name]
	undoPayload, _ := json.Marshal(SetCounterPayload{
		InstanceID: p.InstanceID,
		Name:       p.Name,
		Value:      prevValue,
	})

	if card.Counters == nil {
		card.Counters = make(map[string]int)
	}
	card.Counters[p.Name] = p.Value

	return &Action{Type: ActionSetCounter, Payload: undoPayload}, nil
}

func reduceSetPlayerLife(state *GameState, rawPayload json.RawMessage, playerID string) (*Action, error) {
	var p SetPlayerLifePayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid SET_PLAYER_LIFE payload: %w", err)
	}

	player, ok := state.Players[playerID]
	if !ok {
		return nil, fmt.Errorf("player %s not found", playerID)
	}

	undoPayload, _ := json.Marshal(SetPlayerLifePayload{Life: player.Life})
	player.Life = p.Life

	return &Action{Type: ActionSetPlayerLife, Payload: undoPayload}, nil
}

func reduceLoadDeck(state *GameState, rawPayload json.RawMessage, playerID string) (*Action, error) {
	var p LoadDeckPayload
	if err := json.Unmarshal(rawPayload, &p); err != nil {
		return nil, fmt.Errorf("invalid LOAD_DECK payload: %w", err)
	}

	deckZone := playerID + ":deck"

	// Ensure zone exists
	if _, ok := state.Zones[deckZone]; !ok {
		state.Zones[deckZone] = []string{}
	}

	// Add each card
	for _, entry := range p.Cards {
		instanceID := idgen.New()
		card := &Card{
			InstanceID: instanceID,
			CardID:     entry.CardID,
			ImageURL:   entry.ImageURL,
			OwnerID:    playerID,
			Zone:       deckZone,
			ZoneIndex:  len(state.Zones[deckZone]),
			FaceDown:   true,
			Counters:   make(map[string]int),
		}
		state.Cards[instanceID] = card
		state.Zones[deckZone] = append(state.Zones[deckZone], instanceID)
	}

	undoPayload, _ := json.Marshal(ClearPlayerCardsPayload{})
	return &Action{Type: ActionClearPlayerCards, Payload: undoPayload}, nil
}

func reduceClearPlayerCards(state *GameState, playerID string) (*Action, error) {
	// Collect all cards owned by this player for undo
	var cards []Card
	zoneState := make(map[string][]string)

	for _, zone := range PlayerZones {
		zoneKey := playerID + ":" + zone
		if ids, ok := state.Zones[zoneKey]; ok {
			zoneState[zoneKey] = make([]string, len(ids))
			copy(zoneState[zoneKey], ids)
		}
	}

	for id, card := range state.Cards {
		if card.OwnerID == playerID {
			cards = append(cards, *card)
			delete(state.Cards, id)
		}
	}

	// Clear all player zones
	for _, zone := range PlayerZones {
		zoneKey := playerID + ":" + zone
		state.Zones[zoneKey] = []string{}
	}

	// Build undo as a LOAD_DECK equivalent with full card data
	undoEntries := make([]LoadDeckCardEntry, len(cards))
	for i, c := range cards {
		undoEntries[i] = LoadDeckCardEntry{
			CardID:   c.CardID,
			ImageURL: c.ImageURL,
		}
	}
	undoPayload, _ := json.Marshal(LoadDeckPayload{Cards: undoEntries})
	return &Action{Type: ActionLoadDeck, Payload: undoPayload}, nil
}

// Helper functions

func removeFromZone(state *GameState, zone string, instanceID string) {
	ids := state.Zones[zone]
	for i, id := range ids {
		if id == instanceID {
			state.Zones[zone] = append(ids[:i], ids[i+1:]...)
			return
		}
	}
}

func zoneIndexOf(state *GameState, zone string, instanceID string) int {
	for i, id := range state.Zones[zone] {
		if id == instanceID {
			return i
		}
	}
	return -1
}

func updateZoneIndices(state *GameState, zone string) {
	for i, id := range state.Zones[zone] {
		if card, ok := state.Cards[id]; ok {
			card.ZoneIndex = i
		}
	}
}
