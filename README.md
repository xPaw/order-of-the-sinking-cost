# Order of the Sinking Cost

An unofficial, spoiler-free progress viewer for _Order of the Sinking Star_, live at
[sinkingstar.xpaw.me](https://sinkingstar.xpaw.me/).

> **This project is 100% AI-made.** Claude (Anthropic), working in Claude Code, wrote every line of code and every doc.
> It also did all the reverse engineering, purely from the shipped game, with no source code or official documentation:
>
> - it decompiled the game binary in IDA to work out the save and data formats, the progression rules and mechanics
>   like dragon fire;
> - it checked each finding against real save files.
>
> A human directed, reviewed and tested the work, but wrote none of it. Expect the occasional confidently wrong guess
> about game mechanics; reports are welcome.

Drop your save folder (`%USERPROFILE%\Saved Games\Order of the Sinking Star`) onto the page, or use **Open save
folder**. Everything runs in your browser; the save is only read.

Run locally with your own copy of the game, which the data is built from (see
[scripts/README.md](scripts/README.md)):

```
npm ci
npm run data
npm run dev
```

How the game and the viewer work: [docs/readme.md](docs/readme.md).
