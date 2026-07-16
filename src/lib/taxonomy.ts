// Mirrors context/CONTENT_TAXONOMY.md's topic tree — used by the New Journey
// topic picker (chips/autocomplete) as well as the Time-Bound Test picker.

export interface TaxonomyDomain {
  domain: string;
  chipClass: string; // maps to a `.chip.domain-*` style, see theme.css
  topics: string[];
}

export const TAXONOMY: TaxonomyDomain[] = [
  {
    domain: 'Quantitative Aptitude',
    chipClass: 'quant',
    topics: [
      'Percentages',
      'Profit & Loss',
      'Time, Speed & Distance',
      'Time & Work',
      'Simple & Compound Interest',
      'Ratios & Averages',
      'Probability',
      'Permutations & Combinations',
      'Number Series',
    ],
  },
  {
    domain: 'Logical Reasoning',
    chipClass: 'quant',
    topics: [
      'Seating Arrangements',
      'Blood Relations',
      'Syllogisms',
      'Coding-Decoding',
      'Direction Sense',
      'Series Completion',
      'Puzzles',
      'Data Sufficiency',
    ],
  },
  {
    domain: 'Verbal Ability',
    chipClass: 'quant',
    topics: ['Reading Comprehension', 'Sentence Correction', 'Para-jumbles', 'Vocabulary in Context'],
  },
  {
    domain: 'DSA',
    chipClass: 'dsa',
    topics: [
      'Arrays & Strings',
      'Linked Lists',
      'Stacks & Queues',
      'Trees',
      'Binary Trees',
      'Graphs',
      'Hashing',
      'Recursion',
      'Sorting & Searching',
      'Time/Space Complexity (Big-O)',
      'Dynamic Programming Basics',
    ],
  },
  {
    domain: 'OOP',
    chipClass: 'dsa',
    topics: ['Encapsulation, Inheritance, Polymorphism, Abstraction', 'SOLID Basics', 'Design Pattern Recognition'],
  },
  {
    domain: 'DBMS & SQL',
    chipClass: 'sql',
    topics: ['Normalization', 'Keys & Constraints', 'Joins', 'Indexing Basics', 'Transactions & ACID', 'SQL Joins & Indexing', 'Query-Output Prediction'],
  },
  {
    domain: 'Operating Systems',
    chipClass: 'dsa',
    topics: ['Processes vs Threads', 'Scheduling', 'Deadlock', 'Memory Management', 'Synchronization Basics'],
  },
  {
    domain: 'Computer Networks',
    chipClass: 'dsa',
    topics: ['OSI / TCP-IP Layers', 'HTTP Basics', 'DNS', 'TCP vs UDP', 'Common Ports'],
  },
  {
    domain: 'Predict the Output',
    chipClass: 'dsa',
    topics: ['Python Gotchas', 'Java Gotchas', 'JavaScript Gotchas', 'C++ Gotchas'],
  },
  {
    domain: 'Software Engineer',
    chipClass: 'sd',
    topics: ['System Design Basics', 'Git Fundamentals', 'REST/HTTP API Design', 'Testing Concepts', 'Common Design Patterns'],
  },
  {
    domain: 'AI Engineer',
    chipClass: 'sd',
    topics: ['LLM/Transformer Fundamentals', 'Prompt Engineering', 'Embeddings & Vector Search', 'RAG Concepts', 'Fine-tuning vs Prompting', 'Basic MLOps'],
  },
  {
    domain: 'ML Engineer',
    chipClass: 'ml',
    topics: [
      'Supervised vs Unsupervised Learning',
      'Regression vs Classification',
      'Decision Trees & Ensembles',
      'Overfitting & Regularization',
      'Model Evaluation Metrics',
      'Feature Engineering',
      'Gradient Descent Intuition',
    ],
  },
  {
    domain: 'Data Scientist',
    chipClass: 'ml',
    topics: ['Statistics & Probability', 'A/B Testing', 'Exploratory Data Analysis', 'Pandas & Data Wrangling'],
  },
];

export function domainChipClass(domain: string): string {
  const found = TAXONOMY.find((d) => d.domain === domain);
  return found?.chipClass ?? 'dsa';
}
