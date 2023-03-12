> Note: right now app using this engine is NIY. For now this project is only piece of code handling domain logic of such app.

# WIP
This project isn't production ready yet for a couple of reasons. One of them is that I have to untie it from [tws-libs](https://github.com/teawithsand/tws-libs) `tws-stl` in particular.

# sdelka-engine

Sdelka is [anki](https://github.com/ankitects/anki)-like [SRS](https://en.wikipedia.org/wiki/Spaced_repetition) engine, which implements another variation of SM2 algorithm. It's written entirely in typescript and is web-compatible with IDB-based implementation of storage.

# Docs / Examples
Once you have cloned this project you can `npm run docs` in order to use `typedoc` to generate docs for this project.

For examples take a look at unit tests, which are the best source of docs for this project so far.

# License
This project is AGPL version 3 licensed, just like [anki](https://github.com/ankitects/anki) is. I didn't read or look at Anki code while writing this library. Instead I've recreated algorithm using my experience using Anki and some SM2 algorithm descriptions like [this one on wikipedia](https://en.wikipedia.org/wiki/SuperMemo#Description_of_SM-2_algorithm)

TODO(teawithsand): should I attribute their's copyright? AFAIK implementing somebody's ideas from the scratch isn't.

That being said I am fine with AGPLv3 license, so it's going to stay.

Wow, that's a lot of writing for a project that may end up in trash three days later.