import { beforeEach, expect, test } from 'vitest'
import { clearAnswerDraft, currentAnswers, readAnswerDraft, writeAnswerDraft } from './answerDrafts'

beforeEach(() => localStorage.clear())

test.each([
  '{broken',
  'null',
  '[]',
  '{}',
  '{"submittedAt":null,"answers":[]}',
  '{"submittedAt":null,"answers":{"team":42}}',
  '{"submittedAt":null,"answers":null}',
])('ignores damaged drafts: %s', (stored) => {
  localStorage.setItem('2waymirror:answers:token', stored)
  expect(readAnswerDraft('token', null)).toBeNull()
})

test('removes only the successful session draft', () => {
  const draft = { submittedAt: null, answers: { team: 'Two squads.' } }
  writeAnswerDraft('first', draft)
  writeAnswerDraft('second', draft)
  clearAnswerDraft('first')
  expect(readAnswerDraft('first', null)).toBeNull()
  expect(readAnswerDraft('second', null)?.answers).toEqual(draft.answers)
})

test('filters removed questions and keeps intentionally blank answers', () => {
  expect(
    currentAnswers({ old: 'Old answer', team: '' }, [
      { id: 'team', question: 'Team?', required: true },
      { id: 'new', question: 'New?', required: false },
    ]),
  ).toEqual({ team: '', new: '' })
})
