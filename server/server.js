require('./config/config')

const _ = require('lodash')
const express = require('express')
const bodyParser = require('body-parser')
const { ObjectID } = require('mongodb')

const { mongoose } = require('./db/mongoose')
const { Todo } = require('./models/todo')
const { User } = require('./models/user')
const { authenticate } = require('./middleware/authenticate')

const app = express()
const port = process.env.PORT

app.use(bodyParser.json())

app.get('/', async (req, res) => res.send('lalalala'))

app.post('/todos', authenticate, async (req, res) => {
  const todo = new Todo({
    text: req.body.text,
    _creator: req.user._id
  })

  try {
    const todoRecord = await todo.save()
    res.status(200).send(todoRecord)
  } catch(e) {
    res.status(400).send(e)
  }
})

app.get('/todos', authenticate, async (req, res) => {
  try {
    const todos = await Todo.find({ _creator: req.user._id })
    res.send({ todos })
  } catch(e) {
    res.status(400).send(e)
  }
})

// "5ae1f66cad5c2c134b4af8e7"

app.get('/todos/:id', authenticate, async (req, res) => {
  const id = req.params.id

  try {
    const todo = await Todo.findOne({
      _id: id,
      _creator: req.user._id
    })

    if (!todo) {
      return res.status(404).send() // 404 Not found
    }
    res.status(200).send({ todo })
  } catch(e) {
    res.status(400).send() // 400 Bad Request (id not valid)
  }
})

app.delete('/todos/:id', authenticate, async (req, res) => {
  const id = req.params.id

  try {
    const todo = await Todo.findOneAndRemove({
      _id: id,
      _creator: req.user._id
    })

    if (!todo) {
      return res.status(400).send('resource not found')
    }

    res.status(200).send({ todo })
  } catch(e) {
    res.status(400).send('something went wrong')
  }
})

app.patch('/todos/:id', authenticate, async (req, res) => {
  const id = req.params.id
  const body = _.pick(req.body, ['text', 'completed'])

  try {
    if (!ObjectID.isValid(id)) {
      return res.status(404).send()
    }

    if (_.isBoolean(body.completed) && body.completed) {
      body.completedAt = new Date().getTime()
    } else {
      body.completed = false
      body.completedAt = null
    }

    const todo = await Todo.findOneAndUpdate(
                            { _id: id,
                              _creator: req.user._id
                            },
                            { $set: body },
                            { new: true }
                          )
    
    if (!todo) {
      return res.status(404).send()
    }

    res.send({ todo })
  } catch(e) {
    res.status(404).send('something went wrong')
  }
})

app.post('/users', async (req, res) => {
  const body = _.pick(req.body, ['email', 'password'])
  const user = new User(body)

  try {
    const userEntry = await user.save()
    const token = await user.generateAuthToken()

    res.header('x-auth', token).send(user) // set the header
  } catch(e) {
    res.status(400).send(e)
  }
})

// this route requires authentication
app.get('/users/me', authenticate, async (req, res) => {
  res.send(req.user)
})

app.post('/users/login', async (req, res) => {
  const body = _.pick(req.body, ['email', 'password'])

  try {
    const user = await User.findByCredentials(body.email, body.password)
    const token = await user.generateAuthToken()

    res.header('x-auth', token).send(user)
  } catch(e) {
    res.sendStatus(400)
  }
})

app.delete('/users/me/token', authenticate, async (req, res) => {
  try {
    await req.user.removeToken(req.token)

    res.sendStatus(200)
  } catch(e) {
    res.status(400).send(e) //@todo fix removing non-existing token: Unhandled promise rejection
  }
})

app.listen(port, () => {
  console.log(`Listening on port ${port}...`)
})

module.exports = { app }