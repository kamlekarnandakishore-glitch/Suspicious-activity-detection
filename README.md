# Sentinel AI — Suspicious Activity Detection System 🛡️

[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-purple.svg)](https://vitejs.dev/)
[![Flask](https://img.shields.io/badge/Flask-API-green.svg)](https://flask.palletsprojects.com/)
[![YOLOv8](https://img.shields.io/badge/YOLO-v8-yellow.svg)](https://ultralytics.com/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-47cba5.svg)](https://supabase.com/)

An end-to-end intelligent surveillance system powered by Deep Learning. Sentinel AI captures real-time video feeds, tracks individuals, detects suspicious behavior (violence, weapons, loitering, trespassing), and broadcasts immediate alerts to a full-stack React dashboard (Sentinel Vision) via Supabase real-time databases.

![Sentinel Vision Dashboard](https://via.placeholder.com/1000x500.png?text=Sentinel+Vision+Dashboard) *(Replace with actual screenshot)*

## Features 🚀

- **Real-Time Video Analytics**: Process IP cameras, webcams, or pre-recorded MP4/AVI uploaded videos.
- **Weapon Detection**: Identifies firearms and dangerous objects using advanced ONNX/YOLO models.
- **Violence Detection**: Evaluates frame-by-frame physical altercation probabilities using deep learning models.
- **Loitering & Trespassing**: Configure custom geofenced digital restricted zones directly from the UI with time-delays.
- **Sentinel Vision Dashboard**: A stunning, responsive React/Vite UI to monitor system health, view alerts, and watch live streams.
- **Instant Alert Dispatching**: Supports live push notifications to the dashboard, plus Email (SMTP) and SMS (Twilio) dispatches to security personnel.

## Repository Structure 📁

```text
suspicious-activity-detection/
├── backend/                 # Python Flask API + Deep Learning models
│   ├── app.py               # Main Flask WSGI server
│   ├── config.py            # Environment configurations
│   ├── services/            # Analytics pipelines (YOLO, Violence, Loitering, Alerts)
│   ├── requirements.txt     # Python dependencies
│   ├── yolov8s.pt           # YOLO person detection weights (requires Git LFS)
│   └── alerts/              # Local storage for captured alert snapshots
├── sentinel-vision-main/    # Frontend UI (React + TypeScript + Vite)
│   ├── src/                 # React components and dashboard pages
│   ├── package.json         # Node module dependencies
│   └── .env.example         # Template for environment variables
└── README.md                # Project documentation
```

*Note: Large machine learning model files (`.pt`, `.onnx`, `.h5`) exceed standard GitHub file sizes and should be tracked using [Git Large File Storage (LFS)](https://git-lfs.com/) if you intend to push them directly.*

## Prerequisites 🛠️

Ensure you have the following installed on your machine before beginning:
- [Python 3.10+](https://www.python.org/downloads/)
- [Node.js 18+](https://nodejs.org/en) (and `npm` or `bun`)
- A [Supabase](https://supabase.com/) account for real-time database capabilities

## Installation & Setup 💻

### 1. Database Setup (Supabase)
1. Create a new Supabase project.
2. In the Supabase SQL Editor, run the schema script located at `backend/supabase_schema.sql` to generate the `events`, `security_contacts`, and `alert_dispatches` tables.
3. Enable replication for the `events` table (**Database → Replication → events table**) to ensure real-time UI notifications work.

### 2. Backend Setup (Flask API)
```bash
# Navigate to the backend directory
cd backend

# Create and activate a Python virtual environment
python -m venv venv
source venv/bin/activate       # On Windows use: .\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy the environment file and fill in the secrets
cp .env.example .env
```

Ensure your `backend/.env` file is populated with your Supabase credentials:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
# See .env.example for SMTP and Twilio alert configurations
```

Start the Flask server:
```bash
python app.py
```

### 3. Frontend Setup (Sentinel Vision)
```bash
# Navigate to the frontend directory
cd sentinel-vision-main

# Install Javascript dependencies
npm install

# Copy the environment file and fill in your backend/Supabase endpoints
cp .env.example .env
```

Ensure your `sentinel-vision-main/.env` points to the correct local Flask server:
```env
VITE_API_BASE_URL=http://127.0.0.1:5000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your_anon_key
```

Start the development server:
```bash
npm run dev
```
Navigate to **`http://localhost:8080/`** (or whatever port Vite assigns) in your browser to view the application!

## Page Overview 🗺️

| Route | Description |
|-------|-------------|
| `/` | The main dashboard overview with stats, latest alerts, and a mini feed |
| `/monitoring` | Dedicated full-screen live monitoring (Primary Camera) |
| `/alerts` | Chronological list of all security alerts including captured snapshots |
| `/logs` | Detailed system activity logs directly from Supabase |
| `/settings` | Restricted zones settings and security personnel configurations |

## Contact & Contribution 🤝

Feel free to fork this project, submit pull requests, or open issues if you encounter any bugs or feature requests!
