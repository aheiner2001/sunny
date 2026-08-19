# How to Run and Build the App

This guide contains the terminal commands to install dependencies, run the development server, and build the production bundle for the **Sunny Fleet Accountability** application.

---

## 1. Prerequisites

Ensure you have **Node.js** (v18.x or later recommended) and **npm** installed on your machine.

Check your versions:
```bash
node -v
npm -v
```

---

## 2. Install Dependencies

If you haven't installed packages yet or recently pulled changes:

```bash
npm install
```

---

## 3. Run Development Server

To run the application locally in development mode with hot-reloading:

```bash
npm run dev
```

Once running, open your browser and navigate to:
[http://localhost:3000](http://localhost:3000)

---

## 4. Build for Production

To create an optimized production build:

```bash
npm run build
```

This compiles TypeScript, bundles React/Next.js pages, and outputs artifacts to the `.next` directory.

---

## 5. Run Production Server

After creating a build, you can test and run the production server locally:

```bash
npm run start
```

---

## 6. Linting

To check for code quality and lint errors:

```bash
npm run lint
```

---

## Quick Reference Summary

| Action | Command |
|---|---|
| Install packages | `npm install` |
| Start local dev server | `npm run dev` |
| Build for production | `npm run build` |
| Start production server | `npm run start` |
| Run linter | `npm run lint` |
