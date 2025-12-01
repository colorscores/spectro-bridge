export const qualitySetsData = [
  {
    setName: 'Recommended Foil',
    rules: [
      {
        name: 'Master Reference Recommended',
        reference: 'matching-target',
        metric: 'de2000',
        levels: [
          { rangeFrom: '0.00', rangeTo: '3.00', name: 'Pass', action: 'manual-approve' },
          { rangeFrom: '3.00', rangeTo: 'open', name: 'Fail', action: 'notify-manager' },
        ],
      },
    ],
  },
  {
    setName: 'Recommended Paper',
    rules: [
      {
        name: 'Master Reference Recommended',
        reference: 'matching-target',
        metric: 'de2000',
        levels: [
          { rangeFrom: '0.00', rangeTo: '3.00', name: 'Pass', action: 'manual-approve' },
          { rangeFrom: '3.00', rangeTo: 'open', name: 'Fail', action: 'notify-manager' },
        ],
      },
    ],
  },
  {
    setName: 'Standard Foil',
    rules: [
      {
        name: 'Master Reference Foil',
        reference: 'matching-target',
        metric: 'de2000',
        levels: [
          { rangeFrom: '0.00', rangeTo: '2.00', name: 'Pass', action: 'auto-approve' },
          { rangeFrom: '2.00', rangeTo: '4.00', name: 'Check', action: 'manual-approve' },
          { rangeFrom: '4.00', rangeTo: 'open', name: 'Fail', action: 'notify-manager' },
        ],
      },
      {
        name: 'Approved Matches Foil',
        reference: 'approved-average',
        metric: 'de2000',
        levels: [
          { rangeFrom: '0.00', rangeTo: '1.50', name: 'Pass', action: 'auto-approve' },
          { rangeFrom: '1.50', rangeTo: 'open', name: 'Fail', action: 'notify-manager' },
        ],
      },
    ],
  },
  {
    setName: 'Standard Uncoated Paper',
    rules: [
       {
        name: 'Master Reference Uncoated',
        reference: 'matching-target',
        metric: 'de2000',
        levels: [
          { rangeFrom: '0.00', rangeTo: '3.00', name: 'Pass', action: 'manual-approve' },
          { rangeFrom: '3.00', rangeTo: 'open', name: 'Fail', action: 'notify-manager' },
        ],
      },
       {
        name: 'Approved Matched Uncoated',
        reference: 'approved-average',
        metric: 'dh',
        levels: [
          { rangeFrom: '0.00', rangeTo: '2.5', name: 'Pass', action: 'manual-approve' },
          { rangeFrom: '3.00', rangeTo: 'open', name: 'Fail', action: 'notify-manager' },
        ],
      },
    ]
  },
  {
    setName: 'Standard Coated Paper',
    rules: [
      {
        name: 'Master Reference Coated',
        reference: 'matching-target',
        metric: 'de2000',
        levels: [
          { rangeFrom: '0.00', rangeTo: '2.50', name: 'Pass', action: 'manual-approve' },
          { rangeFrom: '2.50', rangeTo: 'open', name: 'Fail', action: 'notify-manager' },
        ],
      },
    ],
  },
  {
    setName: 'Standard Labels',
    rules: [
       {
        name: 'Master Reference Labels',
        reference: 'matching-target',
        metric: 'de2000',
        levels: [
          { rangeFrom: '0.00', rangeTo: '3.00', name: 'Pass', action: 'manual-approve' },
          { rangeFrom: '3.00', rangeTo: 'open', name: 'Fail', action: 'notify-manager' },
        ],
      },
    ]
  },
  {
    setName: 'Premium Labels',
    rules: [
       {
        name: 'Master Reference Labels Premium',
        reference: 'matching-target',
        metric: 'de2000',
        levels: [
          { rangeFrom: '0.00', rangeTo: '1.50', name: 'Pass', action: 'auto-approve' },
          { rangeFrom: '1.50', rangeTo: '2.50', name: 'Check', action: 'manual-approve' },
          { rangeFrom: '2.50', rangeTo: 'open', name: 'Fail', action: 'notify-manager' },
        ],
      },
    ]
  },
];

export const substrateOptionsData = {
  types: ['Coated Paper', 'Uncoated Paper', 'Film'],
  materials: {
    'Coated Paper': ['Improved', 'Machine', 'Standard', 'Premium'],
    'Uncoated Paper': ['Corrugate', 'Improved', 'Premium', 'Standard', 'Super Cal'],
    'Film': ['Met+White', 'PrelamCardboard', 'Trans+White', 'White (Matte, Glossy, Semi)'],
  },
  surfaceQualities: {
    'Coated Paper': ['Glossy', 'Matte', 'Semigloss'],
    'Uncoated Paper': ['Matte Liner (Corr only)', 'SC/Smooth/Machine'],
    'Film': ['High Gloss', 'Medium Gloss', 'Low Gloss'],
  },
};