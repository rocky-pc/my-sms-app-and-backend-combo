# MySMS – Personal SMS Synchronization System

Please refer to the comprehensive documentation directory in [`docs/`](./docs/README.md) for full architecture, installation, database schema, security analysis, and deployment steps.

### Core Components
1. **Android App (`android-app/`)**: Flutter application with native Kotlin SMS broadcast receiver and offline SQLite queue.
2. **Web Dashboard (`web-dashboard/`)**: Modern React + TypeScript + Vite + Tailwind CSS dashboard deployed to Vercel.
3. **Database & Backend (`supabase/`)**: PostgreSQL schema with strict Row Level Security (RLS) and Realtime replication.
4. **Documentation (`docs/`)**:
   - [`INSTALLATION.md`](./docs/INSTALLATION.md)
   - [`FLUTTER_SETUP.md`](./docs/FLUTTER_SETUP.md)
   - [`SUPABASE_SETUP.md`](./docs/SUPABASE_SETUP.md)
   - [`VERCEL_DEPLOYMENT.md`](./docs/VERCEL_DEPLOYMENT.md)
   - [`SECURITY.md`](./docs/SECURITY.md)
   - [`TROUBLESHOOTING.md`](./docs/TROUBLESHOOTING.md)
