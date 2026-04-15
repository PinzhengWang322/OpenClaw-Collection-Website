# Agent-Powered Personal Collection Website Demo

<p>
  <a href="./README.en.md">
    <img alt="English" src="https://img.shields.io/badge/English-Switch-2f6feb">
  </a>
</p>

A small demo of connecting an agent to a personal website, built entirely through vibe coding.

Steps:
1. Explain the requirements for a personal media collection website to Codex, have it build the frontend and backend, and write a CRUD README.
2. Let the agent on Discord read and understand the website.
3. Verify operations with the agent on Discord, and after everything works, write them into `skills.md`.
4. Maintain the media collection website long-term by chatting with the agent on Discord.

This repository is the cleaned-up public demo version of that setup.

## What It Does

This demo shows one very specific workflow:

- The website itself is a maintainable personal collection site with three sections: movies and TV, games, and travel. It supports card thumbnails, detail modals, pagination, and image galleries.
- You can send natural language messages directly to the agent in Discord and have it add entries, modify fields, replace covers, append detail images, delete entries, and more. You can also send just a title, and the agent will search for the description, category, and cover image on its own.
- Once the agent completes an operation, the result is actually written into the website.
- Image operations are also part of this workflow: for example, if I send a few images in Discord, the agent can use them as a cover or detail images and write them into the site data.

The three images in the README correspond exactly to these actions:

- The first image shows the website itself, demonstrating what the final maintained page looks like.
- The second and third images are real examples of actual operations.

## Preview

The website itself:

![Website](./docs/website.png)

Use chat to let the agent replace a cover and add detail images to the site:

![Chat demo 1](./docs/chat1.png)

Use chat to directly add, modify, and delete entries:

![Chat demo 2](./docs/chat2.png)

## How To Build It

The process is as follows:

1. First, talk with Codex to build the website itself.  
   It started as just the idea of a private collection site, and gradually became more defined as a three-section structure, card layout, detail page, pagination, image gallery, and a web-based admin panel.

2. Then, formalize the maintenance rules for the site.  
   You need to define how data is stored, where images go, how covers are replaced, how detail images are appended, how time is sorted, and how CRUD works from the command line.

3. Then let OpenClaw understand this set of rules.  
   The agent first needs to understand the website’s interface, data structure, and operation paths.

4. Next, debug the workflow back and forth on Discord.  
   Use real messages and image attachments to verify whether add, modify, delete, replace cover, and append detail image operations all correctly land in the website.
   At the same time, make sure you can simply throw a movie title to the agent and have it automatically search and fill in the cover image, description, and other fields. Double-check the requirements carefully.

5. Finally, distill this fully tested workflow into a skill.  
   That way, when maintaining the site later, the agent follows a set of steps that has already been verified.

## Skill

This project includes a companion skill that describes how the website should be maintained.

It mainly contains the following information:

- When a request should be recognized as add, modify, delete, replace cover, or add images
- Which commands or interfaces should be preferred first
- The time field must be `YY.MM`
- Images should use stable local resources whenever possible, instead of fragile external links written into the repository
- How to quickly verify the result after making a change

The skill file is here:

- [skills/collection-site-maintainer/SKILL.md](./skills/collection-site-maintainer/SKILL.md)

If you want more detailed integration notes:

- [docs/openclaw-integration.md](./docs/openclaw-integration.md)
- [examples/discord-prompts.md](./examples/discord-prompts.md)

## Quick Start

Requirements:

- Node.js 22.16+, Node 24 recommended
- No additional database service required

Start:

```bash
cd openclaw-collection-showcase
cd website
npm start
