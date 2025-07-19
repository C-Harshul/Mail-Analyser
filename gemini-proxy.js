const express = require('express');
require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();
router.use(express.json());

let genAI = null;
let model = null;

function initializeGemini() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('Gemini API key not found.');
    return;
  }
  try {
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  } catch (error) {
    console.error('Failed to initialize Gemini:', error);
  }
}

initializeGemini();

// POST /generate - Generate text from prompt
router.post('/generate', async (req, res) => {
  let { prompt } = req.body;
  if (!model) {
    return res.status(500).json({ error: 'Gemini model not initialized or API key missing.' });
  }
  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }
  // Add explicit instruction to the prompt
  prompt = `${prompt}\n\nOutput ONLY a valid JSON object for a new QuickBooks Purchase, suitable for direct POST to the QuickBooks API. Do not include explanation, comments, or any extra text.`;
  try {
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || '';
    // Extract the first JSON object from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'No JSON object found in Gemini response.', raw: text });
    }
    let json;
    try {
      json = JSON.parse(jsonMatch[0]);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse JSON from Gemini response.', raw: text });
    }
    // Print the JSON to the console for inspection
    console.log('Gemini Purchase JSON:', JSON.stringify(json, null, 2));
    // Return only the JSON object
    res.json(json);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /schema - Extract schema from entity sample
router.post('/schema', async (req, res) => {
  const { entitySample } = req.body;
  if (!model) {
    return res.status(500).json({ error: 'Gemini model not initialized or API key missing.' });
  }
  if (!entitySample || !entitySample.trim()) {
    return res.status(400).json({ error: 'entitySample is required.' });
  }
  const prompt = `You are an expert in QuickBooks Online API integration. Given the following JSON data, extract and output the JSON schema that represents the structure, required fields, and data types for this entity.\n\n- The schema should include all top-level and nested fields, their types (string, number, array, object, boolean), and indicate which fields are required for a valid QuickBooks API request.\n- Output only the JSON schema, no explanation or extra text.\n\n### Example Data:\n${entitySample}`;
  try {
    const result = await model.generateContent(prompt);
    const text = result?.response?.text?.() || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    let schema = null;
    if (jsonMatch) {
      try { schema = JSON.parse(jsonMatch[0]); } catch {}
    }
    res.json({ raw: result, schema });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 