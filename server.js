require('dotenv').config()
const express = require('express')
const cors = require('cors')
const path = require('path')

const app = express()

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

app.use('/api/auth', require('./routes/auth'))
app.use('/api/user', require('./routes/user'))

// Serve login como raiz
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')))
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')))
app.get('/editar-perfil', (req, res) => res.sendFile(path.join(__dirname, 'public', 'editar-perfil.html')))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`))
