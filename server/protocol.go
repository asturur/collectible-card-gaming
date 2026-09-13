package main

import "encoding/json"

// Action type constants.
const (
	ActionAddCard          = "ADD_CARD"
	ActionRemoveCard       = "REMOVE_CARD"
	ActionMoveCard         = "MOVE_CARD"
	ActionSetCardPosition  = "SET_CARD_POSITION"
	ActionRotateCard       = "ROTATE_CARD"
	ActionFlipCard         = "FLIP_CARD"
	ActionShuffleZone      = "SHUFFLE_ZONE"
	ActionSetZoneOrder     = "SET_ZONE_ORDER"
	ActionDrawCard         = "DRAW_CARD"
	ActionSetCounter       = "SET_COUNTER"
	ActionSetPlayerLife    = "SET_PLAYER_LIFE"
	ActionLoadDeck         = "LOAD_DECK"
	ActionClearPlayerCards = "CLEAR_PLAYER_CARDS"
)

// Client message type constants.
const (
	MsgAction = "ACTION"
	MsgUndo   = "UNDO"
	MsgPing   = "PING"
)

// Server message type constants.
const (
	MsgWelcome      = "WELCOME"
	MsgStateSync    = "STATE_SYNC"
	MsgActionResult = "ACTION_RESULT"
	MsgPlayerJoined = "PLAYER_JOINED"
	MsgPlayerLeft   = "PLAYER_LEFT"
	MsgError        = "ERROR"
	MsgPong         = "PONG"
)

// Action represents a game action with type and payload.
type Action struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// SequencedAction is an action enriched with server-assigned metadata.
type SequencedAction struct {
	Type      string          `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	Seq       uint64          `json:"seq"`
	PlayerID  string          `json:"playerId"`
	Timestamp int64           `json:"timestamp"`
	Undo      *Action         `json:"undo"`
}

// ClientMessage is the envelope for messages from client to server.
type ClientMessage struct {
	Msg    string `json:"msg"`
	Action *Action `json:"action,omitempty"`
	Seq    uint64  `json:"seq,omitempty"`
}

// ServerMessage is the envelope for messages from server to client.
type ServerMessage struct {
	Msg        string           `json:"msg"`
	PlayerID   string           `json:"playerId,omitempty"`
	PlayerName string           `json:"playerName,omitempty"`
	State      *GameState       `json:"state,omitempty"`
	Log        []SequencedAction `json:"log,omitempty"`
	Action     *SequencedAction `json:"action,omitempty"`
	Error      string           `json:"error,omitempty"`
	RefSeq     uint64           `json:"refSeq,omitempty"`
}

// Payload structs for each action type.

// AddCardPayload is the payload for ADD_CARD.
type AddCardPayload struct {
	CardID   string `json:"cardId"`
	ImageURL string `json:"imageUrl"`
	Zone     string `json:"zone"`
	FaceDown bool   `json:"faceDown"`
}

// RemoveCardPayload is the payload for REMOVE_CARD.
type RemoveCardPayload struct {
	InstanceID string `json:"instanceId"`
}

// MoveCardPayload is the payload for MOVE_CARD.
type MoveCardPayload struct {
	InstanceID string `json:"instanceId"`
	ToZone     string `json:"toZone"`
	ToIndex    *int   `json:"toIndex,omitempty"`
}

// SetCardPositionPayload is the payload for SET_CARD_POSITION.
type SetCardPositionPayload struct {
	InstanceID string  `json:"instanceId"`
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
}

// RotateCardPayload is the payload for ROTATE_CARD.
type RotateCardPayload struct {
	InstanceID string  `json:"instanceId"`
	Angle      float64 `json:"angle"`
}

// FlipCardPayload is the payload for FLIP_CARD.
type FlipCardPayload struct {
	InstanceID string `json:"instanceId"`
}

// ShuffleZonePayload is the payload for SHUFFLE_ZONE.
type ShuffleZonePayload struct {
	Zone string `json:"zone"`
}

// SetZoneOrderPayload is the payload for SET_ZONE_ORDER.
type SetZoneOrderPayload struct {
	Zone  string   `json:"zone"`
	Order []string `json:"order"`
}

// DrawCardPayload is the payload for DRAW_CARD.
type DrawCardPayload struct {
	FromZone string `json:"fromZone"`
	Count    int    `json:"count,omitempty"`
}

// ReturnCardsPayload is the undo payload for DRAW_CARD.
type ReturnCardsPayload struct {
	Cards  []ReturnCardEntry `json:"cards"`
	ToZone string            `json:"toZone"`
}

// ReturnCardEntry represents one card to return during undo of DRAW_CARD.
type ReturnCardEntry struct {
	InstanceID string `json:"instanceId"`
	Index      int    `json:"index"`
}

// SetCounterPayload is the payload for SET_COUNTER.
type SetCounterPayload struct {
	InstanceID string `json:"instanceId"`
	Name       string `json:"name"`
	Value      int    `json:"value"`
}

// SetPlayerLifePayload is the payload for SET_PLAYER_LIFE.
type SetPlayerLifePayload struct {
	Life int `json:"life"`
}

// LoadDeckCardEntry represents one card in a LOAD_DECK action.
type LoadDeckCardEntry struct {
	CardID   string `json:"cardId"`
	ImageURL string `json:"imageUrl"`
}

// LoadDeckPayload is the payload for LOAD_DECK.
type LoadDeckPayload struct {
	Cards []LoadDeckCardEntry `json:"cards"`
}

// ClearPlayerCardsPayload is the payload for CLEAR_PLAYER_CARDS (empty).
type ClearPlayerCardsPayload struct{}

// UndoLoadDeckPayload stores full card states for undo of CLEAR_PLAYER_CARDS.
type UndoLoadDeckPayload struct {
	Cards     []Card  `json:"cards"`
	ZoneState map[string][]string `json:"zoneState"`
}
