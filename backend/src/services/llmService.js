/**
 * LLM service for pre-visit and post-visit summaries.
 *
 * Design goal: the rest of the app never talks to OpenAI directly, and
 * never crashes because of an LLM problem. It calls generatePreVisitSummary
 * / generatePostVisitSummary, which either:
 *   - call the real OpenAI API when OPENAI_API_KEY is set, or
 *   - fall back to a deterministic, rule-based mock so the whole product
 *     works end-to-end with zero paid accounts.
 * Both paths return the exact same shape, and both paths catch their own
 * errors and return a `degraded` result instead of throwing, so a flaky
 * LLM provider never breaks booking, notes submission, etc.
 */
const env = require('../config/env');

const PRE_VISIT_PROMPT = (symptoms) =>
  `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: ${symptoms}`;

const POST_VISIT_PROMPT = (notes) =>
  `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: ${notes}`;

let openaiClient = null;
function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  // Lazy require so the `openai` package is optional when running mocked.
  const OpenAI = require('openai');
  openaiClient = new OpenAI({ apiKey: env.openaiApiKey });
  return openaiClient;
}

// ---------- Mock (rule-based) fallback ----------

const URGENT_KEYWORDS = [
  'chest pain', 'shortness of breath', 'difficulty breathing', 'severe bleeding',
  'unconscious', 'stroke', 'seizure', 'suicidal', 'high fever', 'blue lips',
  'severe pain', 'can\'t breathe', 'cannot breathe',
];
const MEDIUM_KEYWORDS = [
  'fever', 'vomiting', 'persistent cough', 'infection', 'dizziness',
  'moderate pain', 'rash spreading', 'diarrhea', 'migraine',
];

function mockPreVisitSummary(symptoms) {
  const text = (symptoms || '').toLowerCase();
  let urgencyLevel = 'Low';
  if (URGENT_KEYWORDS.some((k) => text.includes(k))) urgencyLevel = 'High';
  else if (MEDIUM_KEYWORDS.some((k) => text.includes(k))) urgencyLevel = 'Medium';

  const chiefComplaint = (symptoms || '').split(/[.\n]/)[0].trim().slice(0, 140) || 'Not specified';

  return {
    urgencyLevel,
    chiefComplaint,
    suggestedQuestions: [
      'How long have you been experiencing these symptoms?',
      'Have the symptoms been getting better, worse, or staying the same?',
      'Are you currently taking any medication, and do you have any known allergies?',
    ],
    generatedBy: 'mock',
    generatedAt: new Date().toISOString(),
  };
}

function mockPostVisitSummary(notes) {
  const text = notes || '';
  return {
    summaryText:
      `Here's a plain-language summary of your visit: ${text.slice(0, 400)}` +
      (text.length > 400 ? '...' : ''),
    medicationSchedule:
      'Please refer to the prescription details below and take medications exactly as instructed by your doctor.',
    followUpSteps:
      'Rest well, stay hydrated, and contact the clinic if symptoms worsen or do not improve within a few days.',
    generatedBy: 'mock',
    generatedAt: new Date().toISOString(),
  };
}

// ---------- Real OpenAI path ----------

async function realPreVisitSummary(symptoms) {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: env.openaiModel,
    messages: [
      {
        role: 'system',
        content:
          'You are a clinical triage assistant. Respond ONLY with strict JSON: ' +
          '{"urgencyLevel":"Low|Medium|High","chiefComplaint":"...","suggestedQuestions":["...","...","..."]}',
      },
      { role: 'user', content: PRE_VISIT_PROMPT(symptoms) },
    ],
    temperature: 0.2,
  });
  const raw = completion.choices[0].message.content;
  const parsed = JSON.parse(raw);
  return { ...parsed, generatedBy: env.openaiModel, generatedAt: new Date().toISOString() };
}

async function realPostVisitSummary(notes) {
  const client = getOpenAIClient();
  const completion = await client.chat.completions.create({
    model: env.openaiModel,
    messages: [
      {
        role: 'system',
        content:
          'You are a medical communicator translating clinical notes into plain language for a patient. ' +
          'Respond ONLY with strict JSON: {"summaryText":"...","medicationSchedule":"...","followUpSteps":"..."}',
      },
      { role: 'user', content: POST_VISIT_PROMPT(notes) },
    ],
    temperature: 0.3,
  });
  const raw = completion.choices[0].message.content;
  const parsed = JSON.parse(raw);
  return { ...parsed, generatedBy: env.openaiModel, generatedAt: new Date().toISOString() };
}

// ---------- Public API (never throws) ----------

async function generatePreVisitSummary(symptoms) {
  if (env.isLlmMocked) return mockPreVisitSummary(symptoms);
  try {
    return await realPreVisitSummary(symptoms);
  } catch (err) {
    console.error('[llmService] pre-visit summary failed, falling back to mock:', err.message);
    return { ...mockPreVisitSummary(symptoms), degraded: true, error: err.message };
  }
}

async function generatePostVisitSummary(notes) {
  if (env.isLlmMocked) return mockPostVisitSummary(notes);
  try {
    return await realPostVisitSummary(notes);
  } catch (err) {
    console.error('[llmService] post-visit summary failed, falling back to mock:', err.message);
    return { ...mockPostVisitSummary(notes), degraded: true, error: err.message };
  }
}

module.exports = { generatePreVisitSummary, generatePostVisitSummary, PRE_VISIT_PROMPT, POST_VISIT_PROMPT };
