# AI Testing Platform - Frontend

A simple, lightweight frontend for the AI Testing Automation Platform. Built with vanilla HTML, CSS, and JavaScript - no build tools required!

## Features

- 🔐 User authentication (login/register)
- 📝 AI-powered test generation from natural language
- ▶️ Test execution with real-time results
- 📊 Test results dashboard
- 🎨 Modern, responsive UI

## Quick Start

### 1. Start the Backend API

First, make sure your backend API is running:

```powershell
# In the project root directory
npm run local:dev
```

The API should be running at `http://localhost:3000`

### 2. Open the Frontend

Simply open `index.html` in your web browser:

**Option A: Double-click**
- Navigate to the `frontend` folder
- Double-click `index.html`

**Option B: Using a local server (recommended)**
```powershell
# If you have Python installed
cd frontend
python -m http.server 8080

# Then open: http://localhost:8080
```

**Option C: Using VS Code Live Server**
- Install "Live Server" extension in VS Code
- Right-click `index.html` → "Open with Live Server"

## Configuration

If your API is running on a different URL, update the `API_BASE_URL` in `app.js`:

```javascript
const API_BASE_URL = 'http://localhost:3000'; // Change this to your API URL
```

## Usage Guide

### 1. Register a New Account

1. Click the "Register" tab
2. Enter your email, password, and tenant ID
3. Click "Register"
4. Switch to "Login" tab after successful registration

### 2. Login

1. Enter your email and password
2. Click "Login"
3. You'll be redirected to the main dashboard

### 3. Generate a Test

1. In the "Generate Test" section:
   - Enter a natural language description of what to test
   - Example: "Test login functionality with valid credentials"
   - Select the target environment (Dev/Staging/Prod)
2. Click "Generate Test"
3. The AI will create a test script for you
4. Copy the Test ID for execution

### 4. Execute a Test

1. In the "Execute Test" section:
   - Paste the Test ID from the generated test
   - Or click "Use this Test ID" button from the generated test
2. Click "Execute Test"
3. View the execution results including:
   - Pass/Fail status
   - Duration
   - Screenshots (if available)
   - Error details (if failed)

### 5. View Test Results

1. Click "Refresh Results" to see all your test executions
2. Results show:
   - Test status (Pass/Fail)
   - Execution timestamp
   - Duration
   - Error messages (if any)

## Features Breakdown

### Authentication
- JWT-based authentication
- Secure password handling
- Persistent login (localStorage)
- Multi-tenant support

### Test Generation
- Natural language input
- AI-powered test script creation
- Environment-specific configuration
- Instant test ID generation

### Test Execution
- One-click test execution
- Real-time status updates
- Screenshot capture
- Detailed error reporting

### Results Dashboard
- All test executions in one place
- Color-coded status indicators
- Sortable by date
- Quick access to test details

## Browser Compatibility

Works on all modern browsers:
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

## Troubleshooting

### "Failed to fetch" Error

**Problem**: Cannot connect to the API

**Solutions**:
1. Make sure the backend is running: `npm run local:dev`
2. Check the API URL in `app.js` matches your backend
3. Verify CORS is enabled on the backend
4. Check browser console for detailed errors

### Login/Register Not Working

**Problem**: Authentication fails

**Solutions**:
1. Ensure LocalStack/DynamoDB is running
2. Check that tables are created: `npm run local:setup:tables`
3. Verify the backend logs for errors
4. Try a different email/tenant ID

### Tests Not Generating

**Problem**: Test generation fails

**Solutions**:
1. Check that Amazon Bedrock is configured (or mock is enabled)
2. Verify your AWS credentials are set
3. Check backend logs for Bedrock errors
4. Ensure the prompt is clear and specific

### Tests Not Executing

**Problem**: Test execution fails

**Solutions**:
1. Verify the Test ID is correct
2. Check that Playwright is installed
3. Ensure the test script is valid
4. Check backend logs for execution errors

## API Endpoints Used

The frontend interacts with these backend endpoints:

- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /tests/generate` - Generate test from prompt
- `POST /tests/execute` - Execute a test
- `GET /tests/results` - Get test results

## Customization

### Styling

Edit `styles.css` to customize:
- Colors (change the gradient colors)
- Fonts (update font-family)
- Layout (adjust padding, margins)
- Responsive breakpoints

### Functionality

Edit `app.js` to:
- Add new features
- Modify API calls
- Change data display
- Add validation

### Layout

Edit `index.html` to:
- Add new sections
- Rearrange components
- Add more form fields
- Include additional information

## Production Deployment

For production use:

1. **Update API URL**: Change `API_BASE_URL` to your production API
2. **Enable HTTPS**: Ensure both frontend and backend use HTTPS
3. **Add Error Tracking**: Integrate Sentry or similar
4. **Optimize Assets**: Minify CSS/JS files
5. **Add Analytics**: Google Analytics or similar
6. **Host Static Files**: Use S3, Netlify, or Vercel

### Deploy to S3 (Example)

```powershell
# Build/prepare files
# (No build step needed for this simple frontend)

# Upload to S3
aws s3 sync frontend/ s3://your-bucket-name/ --acl public-read

# Enable static website hosting in S3 console
```

## Security Notes

- JWT tokens are stored in localStorage (consider httpOnly cookies for production)
- Always use HTTPS in production
- Implement rate limiting on the backend
- Add CSRF protection for production
- Validate all user inputs on the backend

## Future Enhancements

Potential improvements:
- [ ] Add test history charts
- [ ] Implement test scheduling
- [ ] Add bulk test execution
- [ ] Include test result export (PDF/CSV)
- [ ] Add real-time notifications (WebSocket)
- [ ] Implement test result filtering/search
- [ ] Add dark mode toggle
- [ ] Include test comparison view

## Support

For issues or questions:
1. Check the backend logs
2. Review browser console errors
3. Verify API connectivity
4. Check the main project documentation

## License

Same as the main project (MIT)

---

**Built with ❤️ for the AI Testing Automation Platform**
