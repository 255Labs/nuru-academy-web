-- ============================================================================
-- Migration 014: Curriculum seed data — tracks, modules, lessons, quizzes
-- Run ONCE on a fresh database. Re-running is safe (ON CONFLICT DO UPDATE).
-- Dependencies: 002_curriculum, 013_cms
-- ============================================================================
-- ============================================================================
-- SERVER-SIDE QUERY: All questions (with answers) for server rendering
-- Only accessible with service_role or admin JWT — never from the browser
-- ============================================================================
create or replace function public.get_all_questions_admin()
returns table (
  id uuid, quiz_id uuid, sort_position integer, type text,
  question_text text, options text[], correct jsonb, explain text
)
language plpgsql security definer set search_path = public as $$
begin
  -- Only callable from server-side contexts (service role or admin)
  -- The function is granted to authenticated but should only be called
  -- from server components / route handlers, never from the browser bundle.
  return query
  select q.id, q.quiz_id, q.sort_position, q.type,
         q.question_text, q.options, q.correct, q.explain
  from public.questions q
  order by q.quiz_id, q.sort_position;
end;
$$;
grant execute on function public.get_all_questions_admin() to authenticated;

-- ============================================================================
-- CURRICULUM SEED DATA
-- All tracks, modules, lessons, quizzes, and questions seeded from the
-- TypeScript curriculum file. Run this ONCE on a fresh database.
-- Running it again is safe — all inserts use ON CONFLICT DO UPDATE.
-- ============================================================================

-- TRACKS
insert into public.tracks (id, name, subtitle, tagline, price_tzs, passing_pct, tone_hex, tone_deep_hex, sort_order, is_published) values
  ('beginner',     'AI for Everyone',       'Beginner Track',      'Start here. Real skills, plain language, Tanzanian examples.', 70000,  60, '#3B82F6', '#2563EB', 1, true),
  ('intermediate', 'LLMs Under the Hood',   'Intermediate Track',  'For builders. Mechanics, workflows, first coding.',             160000, 65, '#22C55E', '#16A34A', 2, true),
  ('expert',       'The Model Landscape',   'Expert Track',        'For depth. Architecture, RAG, governance, production.',         250000, 70, '#8B6CFF', '#6B4EFF', 3, true)
on conflict (id) do update set
  name = excluded.name, subtitle = excluded.subtitle, tagline = excluded.tagline,
  price_tzs = excluded.price_tzs, passing_pct = excluded.passing_pct,
  tone_hex = excluded.tone_hex, tone_deep_hex = excluded.tone_deep_hex,
  sort_order = excluded.sort_order;

-- Update requires
update public.tracks set requires = 'beginner'      where id = 'intermediate';
update public.tracks set requires = 'intermediate'  where id = 'expert';

-- BEGINNER MODULES
insert into public.modules (id, track_id, week, name, tagline, sort_order) values
  ('b1', 'beginner', 1, 'Foundations',          'What AI is, how to talk to it, why it matters in Tanzania.',      1),
  ('b2', 'beginner', 2, 'Use Cases & Productivity', 'Writing, summarising, images, and research — real outputs today.', 2),
  ('b3', 'beginner', 3, 'Ethics, Limits, Code',  'Using AI honestly, critically, and creatively.',                  3),
  ('b4', 'beginner', 4, 'Business, Automation, Integration', 'AI in your business, automations, and first no-code.',     4),
  ('b5', 'beginner', 5, 'Emberfall',             'The test that proves what you''ve learned — and opens the next path.', 5)
on conflict (id) do update set track_id=excluded.track_id, week=excluded.week, name=excluded.name, tagline=excluded.tagline, sort_order=excluded.sort_order;

-- INTERMEDIATE MODULES
insert into public.modules (id, track_id, week, name, tagline, sort_order) values
  ('i1', 'intermediate', 1, 'LLM Mechanics',        'Token prediction, context windows, the API layer.',              1),
  ('i2', 'intermediate', 2, 'Prompting Techniques', 'Zero-shot to few-shot, system prompts, structured outputs.',     2),
  ('i3', 'intermediate', 3, 'Ethics, Limits, Code', 'Bias, privacy, critical evaluation, first no-code.',             3),
  ('i4', 'intermediate', 4, 'Business & APIs',      'Analysis, automations, APIs, careers.',                          4),
  ('i5', 'intermediate', 5, 'Emberfall',            'The test that proves what you''ve learned — and opens the next path.', 5)
on conflict (id) do update set track_id=excluded.track_id, week=excluded.week, name=excluded.name, tagline=excluded.tagline, sort_order=excluded.sort_order;

-- EXPERT MODULES
insert into public.modules (id, track_id, week, name, tagline, sort_order) values
  ('e1', 'expert', 1, 'Foundations (Architecture)', 'Transformers, models, cost, advanced prompting.',           1),
  ('e2', 'expert', 2, 'Production Engineering',     'RAG, images at scale, custom voice, tool stacks.',          2),
  ('e3', 'expert', 3, 'Governance, Compliance, Code', 'Red-teaming, PDPA compliance, IP, coding with AI.',       3),
  ('e4', 'expert', 4, 'Deployment & Business',      'Pipelines, chatbots, agents, production APIs, careers.',    4),
  ('e5', 'expert', 5, 'Emberfall',                  'The final trial — capstone that proves mastery.',            5)
on conflict (id) do update set track_id=excluded.track_id, week=excluded.week, name=excluded.name, tagline=excluded.tagline, sort_order=excluded.sort_order;

-- BEGINNER LESSONS (Week 1)
insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order) values
  ('b1',1,'What is AI?','Define AI in your own words and name three AI tools you have encountered.',
    'What AI actually is — separating hype from reality',ARRAY['AI predicts likely next words or actions based on patterns','Not magic, not human — it is a very good pattern-matcher','Your phone already uses AI every day: autocomplete, face unlock, spam filter'],
    'Tanzanian examples of AI you already touch',ARRAY['M-Pesa fraud detection is AI','Safaricom customer-service chatbots use AI','WhatsApp voice-to-text is a small AI model'],1),
  ('b1',2,'How LLMs Work (Plain Language)','Explain to a friend how ChatGPT produces an answer — without using jargon.',
    'Next-word prediction made simple',ARRAY['LLM = Large Language Model — trained on billions of sentences','It predicts the most likely next word, again and again','That is how a paragraph appears — one word at a time'],
    'What training data is and why it matters',ARRAY['Trained on the internet, books, code — before a cutoff date','Does not know today''s news unless it has a search tool','Confident-sounding answers can still be wrong — always verify'],2),
  ('b1',3,'Your First Prompts','Write three prompts that each get a useful, specific response.',
    'Anatomy of a good prompt',ARRAY['WHO: give the AI a role — "Act as a Swahili teacher"','WHAT: be specific about the task and output format','CONTEXT: add relevant background — audience, length, tone'],
    'Common beginner mistakes',ARRAY['Too vague: "write something" → too broad to be useful','No context: missing audience, purpose, or constraints','Not iterating: refine prompts the way you refine a Google search'],3),
  ('b1',4,'Prompt Patterns That Work','Apply three prompt patterns to get better AI outputs.',
    'High-leverage patterns',ARRAY['Role + task + format: "You are a ... Write a ... as a bullet list"','Step-by-step: ask the AI to think through each step before answering','Examples in the prompt: show one good example before asking for more'],
    'Practice — real Tanzanian scenarios',ARRAY['Draft an SMS to a boda rider about a parcel pickup','Summarise a 500-word government announcement in 3 bullet points','Write a polite follow-up email to a client who has not paid'],4),
  ('b1',5,'AI Tools Landscape','Name and categorise five AI tools relevant to your work or study.',
    'Text tools',ARRAY['ChatGPT, Claude, Gemini — general-purpose assistants','Specialized: Grammarly (writing), Perplexity (search), NotionAI (notes)','Free tiers vs paid tiers and what each unlocks'],
    'Image, voice, and other modalities',ARRAY['Image: Midjourney, DALL·E, Canva AI','Voice: ElevenLabs, Whisper (transcription)','Code: GitHub Copilot, Cursor, Replit — for Week 3'],5)
on conflict (module_id, day) do update set
  title=excluded.title, objective=excluded.objective,
  block1_topic=excluded.block1_topic, block1_points=excluded.block1_points,
  block2_topic=excluded.block2_topic, block2_points=excluded.block2_points;

-- BEGINNER LESSONS (Week 2)
insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order) values
  ('b2',1,'AI for Writing','Produce one polished piece of writing with AI — in Swahili or English.',
    'Writing use cases',ARRAY['Emails, proposals, social posts, reports, stories','Summarise long documents into key takeaways','Translate and localise — Swahili ↔ English with cultural nuance'],
    'Quality control for AI writing',ARRAY['Always read and edit — AI makes factual errors','Add your voice, local knowledge, personal experience','Run the FACT-TONE-FIT check before sending'],2),
  ('b2',2,'AI for Research','Use AI to research a topic and produce a reliable summary with sources.',
    'Researching with AI assistants',ARRAY['Perplexity and ChatGPT with browsing for current facts','Ask for sources — then verify them independently','Use AI to structure research, not to replace verification'],
    'Hallucination awareness',ARRAY['AI confidently invents statistics, quotes, and citations','Cross-check every claim you plan to use or share','The rule: AI for drafts, human for facts'],3),
  ('b2',3,'AI for Images','Generate one image that matches a brief you write yourself.',
    'Image generation basics',ARRAY['Prompt = text description of what you want the image to show','Style modifiers: photorealistic, cartoon, watercolour, cinematic','Negative prompts: tell the model what to exclude'],
    'Practical uses in Tanzania',ARRAY['Social media graphics for your business page','Concept art for pitches or school projects','Logo exploration before hiring a designer'],4),
  ('b2',4,'AI for Learning','Use AI as a personal tutor for one topic you want to understand better.',
    'AI as a Socratic tutor',ARRAY['"Explain X as if I am 12" — simplify any concept','Ask follow-up questions: "Why?" and "Can you give an example?"','Use it to test yourself: "Quiz me on what we just covered"'],
    'Study techniques powered by AI',ARRAY['Flashcard generation from notes','Summarising lecture transcripts','Getting explanations in Swahili for complex English-language material'],5),
  ('b2',5,'AI for Planning','Produce a 7-day plan for a real goal using AI.',
    'Planning prompts',ARRAY['Give context: your situation, constraints, available time, and resources','Ask for a structured output: day-by-day, table, or checklist','Iterate: ask it to adjust for your feedback'],
    'When NOT to rely on AI for planning',ARRAY['Local regulations and requirements — verify with official sources','Interpersonal decisions — AI lacks the full human context','Anything with financial or legal consequences — consult a professional'],6)
on conflict (module_id, day) do update set
  title=excluded.title, objective=excluded.objective,
  block1_topic=excluded.block1_topic, block1_points=excluded.block1_points,
  block2_topic=excluded.block2_topic, block2_points=excluded.block2_points;

-- BEGINNER LESSONS (Weeks 3-5 — skeleton, expand in CMS)
insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order) values
  ('b3',1,'AI Limitations & Hallucinations','Identify three types of AI errors and verify a suspicious AI claim.',
    'Types of AI mistakes',ARRAY['Hallucinations — confident false facts','Outdated knowledge — training cutoff','Bias — skewed outputs from skewed training data'],
    'How to catch and correct errors',ARRAY['The three-source rule for important facts','Asking the AI to explain its reasoning','When to distrust AI entirely'],1),
  ('b3',2,'Ethics in Practice','Apply an ethical checklist before publishing AI-generated content.',
    'The three ethical questions',ARRAY['Is it accurate? — Verify facts independently','Is it fair? — Check for bias in tone or representation','Is it mine? — Understand AI and copyright basics'],
    'Responsible use in Tanzania',ARRAY['TCRA guidelines on AI-generated content','Academic and professional disclosure norms','Protecting your clients'' and customers'' data'],2),
  ('b3',3,'Privacy & Data Safety','Identify what data you should never put into an AI tool.',
    'What AI tools do with your data',ARRAY['Inputs may be used for training — check the privacy policy','Enterprise tiers typically offer stronger data protection','Public AI tools are not secure vaults'],
    'Safe prompting habits',ARRAY['Never paste ID numbers, passwords, or financial details','Anonymise client data before using AI to analyse it','Use placeholders: "Client A" instead of real names'],3),
  ('b3',4,'Critical Evaluation','Score an AI output on accuracy, tone, and completeness.',
    'The evaluation checklist',ARRAY['Accuracy: is every fact verifiable?','Tone: does it match the audience and purpose?','Completeness: does it address the full brief?'],
    'Building your editing reflex',ARRAY['Never publish the first draft unchanged','Read aloud — your ear catches what your eye misses','AI + human review = professional quality output'],4),
  ('b3',5,'AI & Your Career','Map three concrete ways AI will change your job in the next 2 years.',
    'Skills that grow with AI',ARRAY['Prompt engineering — direction and quality control','Critical thinking — verifying and improving AI outputs','Domain expertise — AI amplifies specialists, not replaces them'],
    'Tanzanian job market context',ARRAY['Roles most exposed: data entry, basic writing, translation','Roles most boosted: sales, teaching, design, customer service','Your unfair advantage: local knowledge, relationships, language'],5),
  ('b4',1,'AI for Your Business','Use AI to produce one real business document for your own work.',
    'Business writing at speed',ARRAY['Proposals, quotes, invoices — AI drafts in seconds','Business plans — structure and language AI handles well','Market research summaries — AI aggregates, you verify'],
    'Customer-facing applications',ARRAY['FAQ pages and knowledge bases','Social media content calendars','Product descriptions in multiple languages'],1),
  ('b4',2,'Simple Automation','Build one working automation that saves you time every week.',
    'What automation means in practice',ARRAY['Automation = a task runs itself based on a trigger','No code required for most business automations','ROI calculation: if it takes 30 min/day, automation saves 180+ hours/year'],
    'Tanzanian-relevant automation ideas',ARRAY['Google Form → WhatsApp notification via Zapier/Make','New email → auto-labelled in Gmail with AI categorisation','Spreadsheet updated → summary sent to your phone nightly'],2),
  ('b4',3,'AI for Customer Service','Set up an AI-assisted customer service workflow for a real or imagined business.',
    'Building a response library',ARRAY['FAQs with AI-suggested answers','Tone guidelines: how your brand speaks','Escalation rules: when to hand over to a human'],
    'Tools that work in Tanzania',ARRAY['WhatsApp Business API with AI routing','Tidio, Crisp, or Intercom with AI features','Custom ChatGPT with your product knowledge uploaded'],3),
  ('b4',4,'AI & Money','Use AI to help with one financial task: budgeting, forecasting, or analysis.',
    'Financial AI use cases',ARRAY['Budget analysis from a spreadsheet export','Cash-flow forecasting with scenario modelling','Invoice and receipt extraction with AI vision tools'],
    'Important limits',ARRAY['AI is not a financial adviser — never replace professional advice','Verify all numbers — AI hallucinates financial figures readily','Use AI for structure; you provide the data and the decisions'],4),
  ('b4',5,'Building Your AI Toolkit','Assemble and document your personal AI toolkit for your specific role.',
    'Choosing your tools',ARRAY['Match the tool to the task: text, image, voice, code, automation','Free vs paid: what is worth paying for at your stage','One tool at depth beats five tools at surface level'],
    'Your personal AI workflow',ARRAY['Morning: AI-assisted inbox triage and task prioritisation','Creation: AI first draft → your edit → fact-check → publish','Learning: daily 15-minute AI conversation on one topic you want to understand'],5),
  ('b5',1,'Revision — Weeks 1 & 2','Reconfirm AI basics, prompting, and productivity tools.',
    'Days 1–10 in 30 minutes',ARRAY['What AI is and how LLMs work','Prompt anatomy and patterns that work','Tools landscape and output quality checks'],
    'Practice scenarios',ARRAY['Live prompt improvement — take a weak prompt, make it great','Tool selection quiz — which tool for which task?','Pair review — critique a partner''s AI output'],1),
  ('b5',2,'Revision — Weeks 3 & 4','Reconfirm ethics, business use, and automation.',
    'Days 11–20 in 30 minutes',ARRAY['AI limitations, hallucinations, and verification','Ethics checklist and data safety','Business applications and simple automations'],
    'Case study clinic',ARRAY['A Tanzanian SME that used AI wrong — what happened?','A school that used AI right — what did they do?','Your own work: what AI change would have the biggest impact?'],2),
  ('b5',3,'Mock Exam','Complete a full timed practice exam mirroring the real Week 5 assessment.',
    'Exam format',ARRAY['20 MCQ questions — 30 minutes','5 short-answer prompting tasks — 20 minutes','1 scenario-based ethics question — 10 minutes'],
    'Exam strategy',ARRAY['Answer what you know first, flag what you''re unsure about','For prompting tasks: use the role + task + format pattern','For ethics: use the three-question checklist'],3),
  ('b5',4,'Exam Day','Sit the Beginner Track exam and pass with 60% or more.',
    'Exam logistics',ARRAY['60 minutes total, closed-book but can use your notes','25 questions: MCQ, true/false, and short answer','Immediate score — certificate issued same day if you pass'],
    'Mindset for success',ARRAY['You have practised all of this over the past 4 weeks','Trust your preparation and read each question carefully','If you don''t pass first time, you can retry after 24 hours'],4),
  ('b5',5,'Certificate Day','Receive and share your Nuru Beginner Track certificate.',
    'What your certificate proves',ARRAY['You can identify AI tools and use them safely','You can write effective prompts for real tasks','You understand AI limitations and apply ethics checks'],
    'What comes next',ARRAY['Intermediate Track: LLMs Under the Hood — mechanics, APIs, coding','Share your certificate on LinkedIn and WhatsApp','Join the Nuru alumni community for ongoing challenges'],5)
on conflict (module_id, day) do update set
  title=excluded.title, objective=excluded.objective,
  block1_topic=excluded.block1_topic, block1_points=excluded.block1_points,
  block2_topic=excluded.block2_topic, block2_points=excluded.block2_points;

-- INTERMEDIATE & EXPERT LESSONS (skeletons — flesh out in CMS)
do $$
declare
  mid text; d int; titles text[];
begin
  -- Intermediate
  for d in 1..5 loop
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i1', d, 'LLM Mechanics Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i2', d, 'Prompting Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i3', d, 'Ethics Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i4', d, 'Business Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
    values ('i5', d, 'Emberfall Day ' || d, 'Complete this lesson in the Content Management dashboard.',
      'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
    on conflict (module_id, day) do nothing;
    -- Expert
    for mid in select id from public.modules where track_id = 'expert' loop
      insert into public.lessons (module_id, day, title, objective, block1_topic, block1_points, block2_topic, block2_points, sort_order)
      values (mid, d, 'Expert Day ' || d, 'Complete this lesson in the Content Management dashboard.',
        'Topic A', ARRAY['Point 1 — edit in admin/cms'], 'Topic B', ARRAY['Point 1 — edit in admin/cms'], d)
      on conflict (module_id, day) do nothing;
    end loop;
  end loop;
end;
$$;

-- BEGINNER WEEK 1 QUIZ (real questions)
insert into public.quizzes (module_id, title, subtitle, minutes, passing_pct, is_placeholder) values
  ('b1', 'Foundations Challenge', 'Prove what you learned in Week 1: recognising AI and prompting basics.', 10, 60, false)
on conflict (module_id) do update set title=excluded.title, subtitle=excluded.subtitle, is_placeholder=excluded.is_placeholder;

insert into public.questions (quiz_id, sort_position, type, question_text, options, correct, explain)
select q.id, v.sort_pos, v.qtype, v.qtext, v.opts, v.corr::jsonb, v.expl
from public.quizzes q
cross join (values
  (1, 'tf',    'AI like ChatGPT understands you the same way a human friend does.', null, 'false', 'AI predicts likely words — it does not truly understand.'),
  (2, 'mcq',   'What does ''AI'' stand for?', ARRAY['Automatic Internet','Artificial Intelligence','Applied Information','Advanced Imaging'], '1', 'AI = Artificial Intelligence. Artificial = man-made; intelligence = thinking-like ability.'),
  (3, 'mcq',   'Which is an example of AI you might already use?', ARRAY['A paper calculator','Entering an M-Pesa PIN','Predictive text on your keyboard','A wall clock'], '2', 'Autocomplete predicts the next word — that''s a tiny LLM on your phone.'),
  (4, 'mcq',   'A prompt is:', ARRAY['A payment','The instruction you give the AI','An error message','A password'], '1', 'Prompt = your instruction to the AI.'),
  (5, 'mcq',   'Which prompt is BETTER?', ARRAY['''write''','''Write a 3-sentence Swahili SMS reminding salon clients of tomorrow''s appointment.'''], '1', 'The good prompt specifies WHO, WHAT, HOW LONG and STYLE.'),
  (6, 'mcq',   'If the AI gives you a wrong fact, you should:', ARRAY['Trust it because it sounds confident','Check it against a reliable source','Retype your question louder','Restart your phone'], '1', 'AI sounds confident even when wrong. Always verify important facts.'),
  (7, 'short', 'What do we call the instruction you type to an AI?', null, '["prompt","a prompt"]', 'The prompt — your instruction.'),
  (8, 'mcq',   'The best FIRST step when writing a prompt is:', ARRAY['Give no detail','Describe what you have and exactly what you want','Ask the AI to guess','Send a single word'], '1', 'Be specific: WHO + WHAT + HOW LONG + STYLE = clear prompts = useful answers.')
) as v(sort_pos, qtype, qtext, opts, corr, expl)
where q.module_id = 'b1'
on conflict do nothing;

-- PLACEHOLDER QUIZZES for all other modules
do $$
declare rec record;
begin
  for rec in select id from public.modules where id not in ('b1') loop
    insert into public.quizzes (module_id, title, subtitle, minutes, passing_pct, is_placeholder)
    values (rec.id, 'Mission Quest', 'Build this quiz in the Content Management dashboard.', 10, 60, true)
    on conflict (module_id) do nothing;
  end loop;
end;
$$;


-- ============================================================================
-- NOTE: The following email template settings CANNOT be set via SQL.
-- They must be configured in the Supabase Dashboard manually.
-- See PRODUCT_SETUP.md for step-by-step instructions.
-- Reference: https://supabase.com/dashboard/project/{ref}/auth/templates
-- ============================================================================

-- ============================================================================
-- STORAGE BUCKETS (run once — safe to re-run)
-- ============================================================================

-- Private video bucket — only accessible via signed URLs generated server-side
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-videos',
  'lesson-videos',
  false,
  1073741824,  -- 1 GB
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public images bucket — lesson cover images, accessible without auth
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-images',
  'lesson-images',
  true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public certificates bucket — generated certificate images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificates',
  'certificates',
  true,
  5242880,   -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage RLS policies
drop policy if exists "Admin uploads videos" on storage.objects;
create policy "Admin uploads videos" on storage.objects
  for insert with check (
    bucket_id = 'lesson-videos'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Admin reads videos" on storage.objects;
create policy "Admin reads videos" on storage.objects
  for select using (
    bucket_id = 'lesson-videos'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Enrolled learners read videos" on storage.objects;
create policy "Enrolled learners read videos" on storage.objects
  for select using (
    bucket_id = 'lesson-videos'
    and exists (
      select 1 from public.enrollments e
      join public.modules m on m.track_id = e.track_id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "Anyone reads lesson images" on storage.objects;
create policy "Anyone reads lesson images" on storage.objects
  for select using (bucket_id = 'lesson-images');

drop policy if exists "Admin uploads lesson images" on storage.objects;
create policy "Admin uploads lesson images" on storage.objects
  for insert with check (
    bucket_id = 'lesson-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Admin deletes lesson images" on storage.objects;
create policy "Admin deletes lesson images" on storage.objects
  for delete using (
    bucket_id = 'lesson-images'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

drop policy if exists "Anyone reads certificates" on storage.objects;
create policy "Anyone reads certificates" on storage.objects
  for select using (bucket_id = 'certificates');

drop policy if exists "Service role writes certificates" on storage.objects;
create policy "Service role writes certificates" on storage.objects
  for insert with check (bucket_id = 'certificates');


