# TeaseMe React App

A React + Vite application providing the frontend for the TeaseMe AI Virtual Girlfriend MVP.

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Building for Production](#building-for-production)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Contributing](#contributing)
- [License](#license)

## Introduction

This project is the frontend client for TeaseMe: an AI-driven chat service that enables influencers to launch personalized virtual girlfriend characters. Built with React, Vite, and TypeScript.

## Features

- Interactive chat UI (text + voice)
- Real-time message streaming
- User authentication and membership flows
- In-app billing and subscription interface
- Modular component library for easy expansion
- Responsive design for desktop and mobile

## Prerequisites

- Node.js >= 16.x
- npm >= 8.x or Yarn >= 1.22.x

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Tease-me/tease-me.git
   cd tease-me
   ```
2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

## Development

Start the development server with hot module replacement:

```bash
npm run start
# or
yarn start
```

The app will be available at `http://localhost:3000`.

## Building for Production

To create an optimized production build:

```bash
npm run build
# or
yarn build
```

Preview the production build locally:

```bash
npm run preview
# or
yarn preview
```

## Project Structure

```
┌── public/          # Static assets
└── src/
    ├── api/        # API 
    ├── assets/     # Assets
    ├── context/    # Custom React hooks
    ├── data/       # API clients and state management
    ├── ui/         # UI Components
    ├── utils/      # Utility functions
    ├── App.tsx     # Root component
    └── main.tsx    # Application entry point
```

## Environment Variables

Create a `.env` file in the project root based on :

```
VITE_NEXT_PUBLIC_BLAND_API_KEY=
VITE_BLAND_API_URL=
VITE_BLAND_WEB_URL=
VITE_BLAND_AGENT_LUNA=
VITE_BLAND_AGENT_TEST=

VITE_TEASE_ME_PROTOCOL=
VITE_TEASE_ME_HOST=
VITE_TEASE_ME_WS_PROTOCOL=
```

## Contributing

1. Fork the repository.
2. Create a new branch: `git checkout -b feature/my-feature`.
3. Commit your changes: `git commit -m 'Add my feature'`.
4. Push to the branch: `git push origin feature/my-feature`.
5. Open a pull request.