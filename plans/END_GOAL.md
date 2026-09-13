I want to create an hosted app that runs on the user browser.
The app is meant to be a blank canvas with shared state between more users.
One user own a temporary server for the state and the other connect to it for state sharing.
The initial version will be prototyped to run in 2 browser window on the same computer via the server to avoid network issues and tunnelling problems.

The app consist of a card game with no rules engines or turns.
The app end goal is to display cards and let users interact with them freely.
Initialy there will be actions like turn card 90degree or flip card, draw card from a deck, look card from a deck. Very basic functionality.
The app does not allow to resume a game or save it, is used in the span of time you are in front of the computer with your friend on the other side of the internet wire.

The card art will be fetched from online databases. The game has no idea what card is that outside its id and linked picture.
For card rendering i want to use fabricJS because the serialization from and to strings is good for my online purpose.

I want 3 agents to investigate those 3 plans and come back with a detailed implementation plans for those 3 points below
Your job as main agent is to read the 3 summary of plan and add details so that the comunication between the app and the server can be sucessful rather than a second thought

# plan 1
One plan is to setup the app, the environment for devs, and the deploy actions and test suite on github. Vite is good enough for me, so i would use that.
When the first part is done we have a vite app that can be deploy each push to main branch and that auto deploy on github pages.
The app has a single text input with a button join server. It uses tailwind with baseUI and any theme really.
This repo will also host the server app.

# plan 2
Second plan is to create the server app.
This server app should be in GO so everyone can run the server, linux, winzozz and macos.
The Go app is built on github and retrieve via the releases functionality.
The app only functionality is to host the server. the server works like a room, everyone in the room can add or change state.
There isn't collision handling. People will say wait, is my turn, wait a second, or i want to play an interrupt.
The preferred message format is an action with a payload and a sort of redux library for go that given the action will reduce it and produce the new state.
Each action should also carry its own counter command so state can be unwinded playing back the different action received.
When a new client connect it receives all the state, so every user knows all the card of the other users but we are mature adults that are not going to sniff the message queue to cheat.
Preferibly we use websockets.
We can start with a Node implementation if we think is easier to start with for compilation issues and what not.
Deciding the stack is part of the investigation plan.

# plan 3
Card artwork.
We need an online database of magic the gatering that can be accessed online with no hosting or paid API and of which the images can be loaded by our app without cors issues.
If cors are an issue, they have at least to allow for image loading, we don't care for being able to access image pixels.
If there is metadata on the card it is good to fetch that as well so that the user can read it outside the cart image. For the initial implementation we need
- images for magic the gatering cards, from alpha to modern cards and expansions.
- common deck composition for premade decks, official and custom made, so that user can say, grab a deck black aggro with only old school cards and can display it and change it
- initially full card search and swapping is not included.

Once the 3 plans come back i want to read them not jump straight to implementation.
