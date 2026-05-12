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
app.use('/api/church', require('./routes/church'))
app.use('/api/ministry', require('./routes/ministry'))
app.use('/api/department', require('./routes/department'))

// Serve login como raiz
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')))
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')))
app.get('/editar-perfil', (req, res) => res.sendFile(path.join(__dirname, 'public', 'editar-perfil.html')))
app.get('/configuracoes', (req, res) => res.sendFile(path.join(__dirname, 'public', 'configuracoes.html')))
app.get('/ministerios', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ministerios.html')))
app.get('/ministerio/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'ministerio-detalhe.html')))
app.get('/departamentos', (req, res) => res.sendFile(path.join(__dirname, 'public', 'departamentos.html')))
app.get('/departamento/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'departamento-detalhe.html')))

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`))
