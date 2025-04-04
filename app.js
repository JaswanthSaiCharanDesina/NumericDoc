const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase
const serviceAccount = require('./key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://numericdoc-597bb.firebaseio.com" // Replace with your URL
});

const db = admin.firestore();
const app = express();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// Set EJS as view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const userRef = db.collection('users').where('email', '==', email).limit(1);
    const snapshot = await userRef.get();
    
    if (snapshot.empty) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    let user;
    snapshot.forEach(doc => {
      user = doc.data();
      user.id = doc.id;
    });
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email
    };
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Something went wrong' });
  }
});

app.get('/signup', (req, res) => {
  res.render('signup');
});

app.post('/signup', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  
  if (password !== confirmPassword) {
    return res.render('signup', { error: 'Passwords do not match' });
  }
  
  try {
    // Check if email already exists
    const emailCheck = await db.collection('users').where('email', '==', email).limit(1).get();
    if (!emailCheck.empty) {
      return res.render('signup', { error: 'Email already in use' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const userRef = await db.collection('users').add({
      username,
      email,
      password: hashedPassword,
      documents: {
        aadhar: '',
        pan: '',
        drivingLicense: '',
        rationCard: ''
      }
    });
    
    req.session.user = {
      id: userRef.id,
      username,
      email
    };
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('signup', { error: 'Registration failed' });
  }
});

app.get('/dashboard', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  try {
    const userDoc = await db.collection('users').doc(req.session.user.id).get();
    const userData = userDoc.data();
    
    res.render('dashboard', {
      user: req.session.user,
      documents: userData.documents
    });
  } catch (err) {
    console.error(err);
    res.redirect('/login');
  }
});

app.post('/save-details', async (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  
  const { aadhar, pan, drivingLicense, rationCard } = req.body;
  
  try {
    await db.collection('users').doc(req.session.user.id).update({
      'documents.aadhar': aadhar,
      'documents.pan': pan,
      'documents.drivingLicense': drivingLicense,
      'documents.rationCard': rationCard
    });
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.redirect('/dashboard');
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});