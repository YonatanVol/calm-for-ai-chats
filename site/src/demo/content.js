/**
 * The pretend conversation. Deliberately generic: no product name, no logo,
 * no model name and no colour borrowed from any real chat service. The Hebrew
 * paragraph is there to show per-paragraph right-to-left in Focus Reader.
 */

export const HISTORY = ['Planning a week of study', 'Explain recursion simply', 'סיכום הרצאה', 'Notes on sleep']

export const TITLE = 'Reading long answers'

export const QUESTION = 'Why do long answers feel so hard to read?'

export const ANSWER = [
  { tag: 'h3', text: 'Too many things want your eyes' },
  {
    tag: 'p',
    text: 'A long answer asks you to hold several ideas at once. Meanwhile the page keeps offering other things to look at: a sidebar, suggestions, the box waiting for your reply. Each one takes a little of the attention the sentence needed.',
  },
  { tag: 'p', text: 'קריאה נעשית קלה יותר כשיש פחות רעש סביב הטקסט, והעין יודעת איפה לנחות בכל מילה.' },
  {
    tag: 'p',
    text: 'So give the answer a quiet page of its own, keep the lines a comfortable length, and let every word offer your eye a place to land.',
  },
]

export const CHIPS = ['Make it shorter', 'Give an example', 'Explain it simply']
