# Clash of Crowns - Chess App

A high-performance, feature-rich Chess application built with React, Three.js, and Firebase.

## 🚀 Project Structure

The codebase is organized following modern React best practices to ensure maintainability and scalability.

### `/src`
- **`/assets`**: Static assets like images, sounds, and global styles.
- **`/components`**: Reusable UI components.
  - **`/game`**: Components related to the chess board (2D and 3D views).
  - **`/screens`**: Full-page screen components representing different app states.
  - **`/ui`**: Generic UI elements like buttons, modals, and inputs.
- **`/lib`**: Core logic, external service configurations, and utilities.
  - `chess-logic.ts`: The engine handling chess rules and move validation.
  - `firebase/firebase.ts`: Firebase initialization and configuration.
  - `store/store.ts`: Local storage management for player data.
  - `translations.ts`: Multi-language support logic.
- **`/types`**: TypeScript interfaces and type definitions.
- `App.tsx`: The main application entry point and router.
- `main.tsx`: React DOM mounting point.

### `/docs`
- Organized project specifications, reports, phase histories, and guides. See [docs/README.md](docs/README.md).

### `/public`
- Static assets served directly (icons, manifest, etc.).

### `/Unity`
- Contains Unity-related project files and assets for future integration or reference.

## 🛠️ Tech Stack
- **Frontend**: React 18, Vite, Tailwind CSS
- **3D Rendering**: Three.js, @react-three/fiber, @react-three/drei
- **Animations**: Framer Motion (motion/react)
- **Backend**: Firebase (Authentication, Firestore)
- **Icons**: Lucide React

## 📖 Developer Guide
- **Adding a new screen**: Create a component in `src/components/screens` and add it to the router in `App.tsx`.
- **Modifying Chess Logic**: All game rules are encapsulated in `src/lib/chess-logic.ts`.
- **Styling**: Use Tailwind CSS utility classes for consistent and responsive design.

---
*Created with ❤️ for the Chess community.*
