require("dotenv").config()
const OpenAI = require("openai")
const express = require("express")
const { OPENAI_API_KEY, ASSISTANT_ID } = process.env

const app = express()
app.use(express.json())

const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
const assistantId = ASSISTANT_ID

let pollingInterval

const createThread = async () => {
    console.log("Creating a new thread...")
    const thread = await openai.beta.threads.create()
    return thread
}

const addMessage = async (threadId, message) => {
    console.log("Adding a new message to thread: " + threadId)
    const response = await openai.beta.threads.messages.create(
        threadId,
        {
            role: "user",
            content: message
        }
    )
    return response
}

const runAssistant = async (threadId) => {
    console.log("Running assistant for thread: " + threadId)
    const response = await openai.beta.threads.runs.create(
        threadId,
        {
            assistant_id: assistantId
        }
    )
    console.log(response)
    return response
}

const checkingStatus = async (res, threadId, runId) => {
    const runObject = await openai.beta.threads.runs.retrieve(
        threadId,
        runId
    )

    const status = runObject.status
    console.log(runObject)
    console.log("Current status: " + status)

    if (status == "completed") {
        clearInterval(pollingInterval)

        const messagesList = await openai.beta.threads.messages.list(threadId)
        let messages = []

        messagesList.body.data.forEach(message => {
            messages.push(message.content)
        })

        res.json({ messages })
    }
}

app.get("/thread", (req, res) => {
    createThread().then(thread => {
        res.json({ threadId: thread.id })
    })
})

app.post("/message", (req, res) => {
    const { message, threadId } = req.body
    addMessage(threadId, message).then(message => {
        runAssistant(threadId).then(run =>{
            const runId = run.id

            pollingInterval = setInterval(() => {
                checkingStatus(res, threadId, runId)
            }, 5000)
        })
    })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
})