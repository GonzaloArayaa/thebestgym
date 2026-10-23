# The Best Gym - Sistema de Gestión

## Overview
This is a gym management system ("The Best Gym") built as a single-page application with vanilla JavaScript, HTML, and CSS. It provides a complete management interface for gym administrators, receptionists, and members.

## Project Structure
- `index.html` - Main HTML file containing all the UI components
- `script.js` - JavaScript application logic with in-memory database
- `styles.css` - Complete styling for the application
- `server.py` - Python HTTP server for serving static files

## Features

### For Administrators & Receptionists:
- **Dashboard**: Overview of active members, attendance, payments, and key metrics
- **Member Management**: View, search, and manage gym members
- **Attendance Control**: Register member check-ins and view history
- **Payment Processing**: Record payments and track payment history
- **Plan Management**: View and manage membership plans

### For Members:
- **My Plan**: View membership details, expiry dates, and plan status
- **My Schedule**: Book and manage class reservations
- **Goals & Tracking**: Set fitness goals and track progress
- **My Profile**: Update personal information and emergency contacts

## Test Credentials

The application comes with pre-configured test users:

- Las credenciales deben definirse durante la instalación y cambiarse antes de usar el sistema.

## Technology Stack
- Frontend: Vanilla JavaScript, HTML5, CSS3
- Icons: Font Awesome 6.4.0
- Server: Python 3.11 HTTP Server
- Data: In-memory JavaScript database (no backend persistence)

## Running the Application
The application runs on port 5000 and is automatically served via the configured workflow.

To manually start the server:
```bash
python server.py
```

The server includes cache control headers to ensure updates are immediately visible.

## Current State
- All static files are properly configured
- Server is running on port 5000 with cache disabled
- Application is fully functional with test data
- Ready for deployment

## User Preferences
None specified yet.

## Recent Changes
- 2025-10-14: Initial import and setup completed
  - Fixed JavaScript error (duplicate code removal)
  - Configured Python HTTP server with cache control
  - Set up workflow for port 5000
  - Verified all functionality working correctly
