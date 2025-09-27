// --- CONFIGURATION ---
const SUPABASE_URL = 'https://wvdnisgzuixmshwgvuyc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind2ZG5pc2d6dWl4bXNod2d2dXljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5NzU0NTcsImV4cCI6MjA3NDU1MTQ1N30.PPjbthgBzmP6S8aljThHmHERWZj1ATLwL71QnFF-jbM';

// --- INITIALIZE SUPABASE CLIENT ---
const { createClient } = supabase;
const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- DOM ELEMENTS ---
const loadingSpinner = document.getElementById('loading-spinner');
const authPage = document.getElementById('auth-page');
const dashboardPage = document.getElementById('dashboard-page');
const loginView = document.getElementById('login-view');
const signupView = document.getElementById('signup-view');
const showSignup = document.getElementById('show-signup');
const showLogin = document.getElementById('show-login');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const googleSignInBtn = document.getElementById('google-signin-btn');
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');
const uploadSection = document.getElementById('upload-section');
const uploadForm = document.getElementById('upload-form');
const modAppsGrid = document.getElementById('mod-apps-grid');
const videosGrid = document.getElementById('videos-grid');
const toolsGrid = document.getElementById('tools-grid');

// --- STATE ---
let currentUser = null;
let userProfile = null;

// --- FUNCTIONS ---

// Function to switch between login and signup views
showSignup.addEventListener('click', (e) => {
    e.preventDefault();
    loginView.style.display = 'none';
    signupView.style.display = 'block';
});

showLogin.addEventListener('click', (e) => {
    e.preventDefault();
    signupView.style.display = 'none';
    loginView.style.display = 'block';
});

// Handle User Signup
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('signup-username').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const role = document.getElementById('signup-role').value;

    const { data, error } = await _supabase.auth.signUp({ email, password });

    if (error) {
        alert('Error signing up: ' + error.message);
        return;
    }
    
    // Create a profile for the new user
    const { error: profileError } = await _supabase
        .from('profiles')
        .insert({ id: data.user.id, username, role });

    if (profileError) {
        alert('Error creating profile: ' + profileError.message);
    } else {
        alert('Signup successful! Please check your email to verify.');
        signupForm.reset();
        showLogin.click();
    }
});

// Handle User Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    // Special check for hardcoded admin credentials
    if (email === 'rapturetechrodney@gmail.com' && password === '123478') {
        const { data, error } = await _supabase.auth.signInWithPassword({ email, password });
        if (error) alert('Admin login failed: ' + error.message);
        return;
    }

    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Error logging in: ' + error.message);
});

// Handle Google Login
googleSignInBtn.addEventListener('click', () => {
    _supabase.auth.signInWithOAuth({ provider: 'google' });
});

// Handle Logout
logoutBtn.addEventListener('click', async () => {
    await _supabase.auth.signOut();
});

// Fetch user profile and role from the 'profiles' table
async function fetchUserProfile(userId) {
    const { data, error } = await _supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    
    if (error) {
        console.error('Error fetching profile:', error);
        return null;
    }
    return data;
}

// Fetch and Display Posts
async function fetchAndDisplayPosts() {
    const { data: posts, error } = await _supabase.from('posts').select('*');
    if (error) {
        console.error('Error fetching posts:', error);
        return;
    }

    // Clear existing content
    modAppsGrid.innerHTML = '';
    videosGrid.innerHTML = '';
    toolsGrid.innerHTML = '';

    posts.forEach(post => {
        const postCard = `
            <div class="card">
                <h4>${post.title}</h4>
                <p>${post.description}</p>
                <a href="${post.file_url}" class="download-btn" target="_blank" download>Download</a>
                ${userProfile && userProfile.role === 'admin' ? `<button class="delete-btn" data-id="${post.id}">Delete (Admin)</button>` : ''}
            </div>
        `;
        if (post.category === 'Mod App') modAppsGrid.innerHTML += postCard;
        else if (post.category === 'Video') videosGrid.innerHTML += postCard;
        else if (post.category === 'Tool') toolsGrid.innerHTML += postCard;
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const postId = e.target.getAttribute('data-id');
            if (confirm('Are you sure you want to delete this post?')) {
                await deletePost(postId);
            }
        });
    });
}

// Handle File Upload
uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('upload-title').value;
    const description = document.getElementById('upload-description').value;
    const category = document.getElementById('upload-category').value;
    const file = document.getElementById('file-input').files[0];

    if (!file) {
        alert('Please select a file to upload.');
        return;
    }

    const fileName = `${Date.now()}_${file.name}`;
    const { error: uploadError } = await _supabase.storage.from('mod-files').upload(fileName, file);

    if (uploadError) {
        alert('Error uploading file: ' + uploadError.message);
        return;
    }

    const { data } = _supabase.storage.from('mod-files').getPublicUrl(fileName);
    const publicURL = data.publicUrl;

    const { error: insertError } = await _supabase.from('posts').insert({
        title,
        description,
        category,
        file_url: publicURL,
        uploader_email: currentUser.email
    });

    if (insertError) {
        alert('Error saving post details: ' + insertError.message);
    } else {
        alert('File uploaded successfully!');
        uploadForm.reset();
        fetchAndDisplayPosts();
    }
});

// Delete a post (Admin only)
async function deletePost(postId) {
    const { error } = await _supabase.from('posts').delete().eq('id', postId);
    if (error) {
        alert('Error deleting post: ' + error.message);
    } else {
        alert('Post deleted.');
        fetchAndDisplayPosts();
    }
}

// Main function to check session and update UI
async function checkSession() {
    const { data } = await _supabase.auth.getSession();
    currentUser = data.session ? data.session.user : null;

    loadingSpinner.style.display = 'none';

    if (currentUser) {
        userProfile = await fetchUserProfile(currentUser.id);
        authPage.style.display = 'none';
        dashboardPage.style.display = 'block';
        userEmailSpan.textContent = currentUser.email;
        
        // Show upload section for developers and admins
        if (userProfile && (userProfile.role === 'developer' || userProfile.role === 'admin')) {
            uploadSection.style.display = 'block';
        } else {
            uploadSection.style.display = 'none';
        }

        fetchAndDisplayPosts();
    } else {
        dashboardPage.style.display = 'none';
        authPage.style.display = 'block';
        userProfile = null;
    }
}

// Listen for auth state changes
_supabase.auth.onAuthStateChange((event, session) => {
    checkSession();
});

// Initial check when the page loads
checkSession();
  
