# Credit Card Offers Extractor

A browser extension and web application to extract, store, and manage credit card offers from American Express and Chase.

## Features

- 🔍 **Extract Offers**: Browser extension to extract offers from Amex and Chase websites
- ☁️ **Cloud Storage**: Sync offers to Supabase database
- 🎨 **Web Dashboard**: Beautiful web interface to view and search all offers
- 🔎 **Search & Filter**: Search by merchant name, filter by source (Amex/Chase)
- 📊 **Statistics**: View offer counts by source
- 💾 **Export**: Export offers to CSV

## Project Structure

```
credit-card-shopping/
├── extension/           # Browser extension files
│   ├── manifest.json
│   ├── content.js
│   ├── popup.html/js/css
│   └── icons/
├── backend/             # Node.js backend API
│   ├── server.js
│   ├── routes/
│   ├── models/
│   └── database/
├── frontend/            # Web dashboard
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── README.md
```

## Setup Instructions

### 1. Supabase Setup

1. Go to [Supabase](https://supabase.com) and create a free account
2. Create a new project
3. Go to SQL Editor and run the SQL from `backend/database/schema.sql`
4. Go to Settings → API and copy:
   - Project URL
   - Anon/public key

### 2. Backend Setup

1. Navigate to backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` and add your Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key
   PORT=3000
   NODE_ENV=development
   ```

5. Start the server:
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

   The server will run on `http://localhost:3000`

### 3. Frontend Setup

The frontend is already configured to work with the backend. Just make sure the backend is running, then:

1. Open `http://localhost:3000` in your browser
2. The dashboard will automatically load offers from the backend

### 4. Extension Setup

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the root directory of this project (where `manifest.json` is)
5. The extension should now be installed

### 5. Configure Extension API URL

1. Open `popup.js` in the extension folder
2. Find the line: `const API_BASE_URL = 'http://localhost:3000';`
3. Update it to your backend URL:
   - For local: `http://localhost:3000`
   - For production: `https://your-backend-url.com`

## Usage

### Extracting Offers

1. Navigate to:
   - Amex: `https://global.americanexpress.com/offers/eligible`
   - Chase: `https://secure.chase.com/web/auth/dashboard#/dashboard/merchantOffers/...`
2. Click the extension icon
3. Click "Extract Offers"
4. Click "Sync to Server" to save to database

### Viewing Offers

1. Make sure backend is running
2. Open `http://localhost:3000` in your browser
3. View all offers, search by merchant name, or filter by source

## API Endpoints

- `GET /api/offers` - Get all offers (with optional query params: `?source=Amex&search=merchant`)
- `GET /api/offers/stats` - Get statistics
- `GET /api/offers/:id` - Get single offer
- `POST /api/offers` - Create new offer(s)
- `PUT /api/offers/:id` - Update offer
- `DELETE /api/offers/:id` - Delete offer

## Development

### Backend Development

```bash
cd backend
npm run dev  # Uses nodemon for auto-reload
```

### Frontend Development

The frontend is served by the backend. Just start the backend server and access `http://localhost:3000`.

## Production Deployment

### Backend

Deploy to:
- **Railway**: Easy deployment, connects to Supabase
- **Heroku**: Traditional option
- **Render**: Free tier available
- **DigitalOcean**: More control

Update the `API_BASE_URL` in `popup.js` to your deployed backend URL.

### Frontend

The frontend is served by the backend, so deploying the backend also deploys the frontend.

Alternatively, deploy frontend separately to:
- **Netlify**
- **Vercel**
- **GitHub Pages**

Update `API_BASE_URL` in `frontend/app.js` to point to your backend.

## Future Enhancements

- [ ] Email integration (parse offers from email)
- [ ] User authentication
- [ ] Offer expiration alerts
- [ ] Advanced filtering and sorting
- [ ] Export to multiple formats
- [ ] Mobile app

## License

ISC

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
