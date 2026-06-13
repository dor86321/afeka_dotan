# Afeka_dotan

This repository contains course assignment websites for an introductory HTML class. The website is organized for GitHub Pages publishing from the main branch and the project root.

## Repository URL

https://github.com/dor86321/afeka_dotan

## Live Site URL

https://dor86321.github.io/afeka_dotan/

## Homework 1 URL

https://dor86321.github.io/afeka_dotan/hw1/

## Homework 2 URL

https://dor86321.github.io/afeka_dotan/hw2/

## Homework 3 URL

https://dor86321.github.io/afeka_dotan/hw3/

## Project structure

```
index.html          Home page (assignment menu + CNN glossary)
css/style.css       Shared styles for the home page
js/main.js          Home page scripts

hw1/                Homework 1 – HTML image-map travel site
  index.html
  page1.html … page5.html
  style.css
  images/

hw2/                Homework 2 – browser CNN shape classifier
  index.html        Model UI (Canvas, train, predict)
  dictionary.html   AI / CNN glossary (40+ terms)
  css/hw2.css
  js/hw2-model.js
  js/hw2-dictionary.js

hw3/                Homework 3 – n8n AI travel page automation
  index.html        Assignment overview and links
  README.md         Full documentation (workflow, prompts, APIs)
  workflow/         n8n import JSON + Code snippets
  templates/        Responsive HTML travel page template
  prompts/          Groq prompts A–E
  google-sheets/    Sheet setup guide
  SUBMISSION_SLIDES.md
  css/hw3.css
```

## Homework 2 notes

- Vanilla JavaScript only (no TensorFlow.js or other external libraries).
- CNN classifies circle, square, and triangle drawings from Canvas.
- Model weights and samples are saved in **LocalStorage**.
- Open `index.html` locally or use the live GitHub Pages URLs above.

## Homework 3 notes

- **n8n** workflow: Google Sheets → Groq AI → HTML page → GitHub backup → Gmail approval → sheet update.
- Import workflow: **[hw3/workflow/travel-page-automation.json](./hw3/workflow/travel-page-automation.json)**
- Full guide: **[hw3/README.md](./hw3/README.md)** · Overview page: **[hw3/index.html](./hw3/index.html)**
- **Google Sheet:** https://docs.google.com/spreadsheets/d/1039zHFjCtQtrnEgMc5bQ2wpKAJw-SABn5X9v4So_HKA/edit?usp=sharing (tab: `Sheet1`)
- Stack: Google Sheets, Groq (free tier), Gmail Send and Wait, GitHub file backup, OpenStreetMap embed.

## Student

Dor Dotan · Web deployment - 10266
