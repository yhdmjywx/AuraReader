// Website-only transport. The production repositories and controllers are unchanged.
import { aliceBook } from './alice.js';
const copy = value => structuredClone(value);
const books = new Map([[aliceBook.id, { id: aliceBook.id, value: copy(aliceBook), generation: 'demo-generation', revision: 1, deleted: false }]]);
const notes = new Map();
const queues = new Map();
const operations = new Map();
export const operationId = () => crypto.randomUUID();
export const initializeStorage = async () => ({ completed: true });
export const readBooks = async () => copy([...books.values()]);
export const readNotes = async (bookIds = []) => copy([...notes.values()].filter(row => !bookIds.length || bookIds.includes(row.bookId)));
export const bookVersion = async id => copy(books.get(id) || { revision: 0 });
export const noteVersion = async id => copy(notes.get(id) || { revision: 0 });
export function enqueue(id, task) {
  const next = (queues.get(id) || Promise.resolve()).catch(() => {}).then(task);
  queues.set(id, next);
  next.finally(() => { if (queues.get(id) === next) queues.delete(id); }).catch(() => {});
  return next;
}
export async function drainStorage() { await Promise.all([...queues.values()]); }
export function acceptBook() {}
export function acceptNote() {}
export function configureStorage() { throw new Error('体验区不连接外部书库'); }
export function unwrapDesktop(result) { if (result.ok) return result.value; throw new Error(result.error.message); }
export async function restoreRecords() { throw new Error('请在桌面版中导入书籍备份'); }
export async function storageRequest(route, body) {
  if (route === 'books') return { records: await readBooks() };
  if (route === 'notes/query') return { records: await readNotes(body.bookIds) };
  if (body?.opId && operations.has(body.opId)) return copy(operations.get(body.opId));
  const isBook = route.startsWith('books/');
  const item = isBook ? body.book : body.note;
  const id = item?.id || body.id;
  const store = isBook ? books : notes;
  const current = store.get(id);
  if ((current?.revision || 0) !== body.expected) throw Object.assign(new Error('体验数据版本冲突，请重置体验'), { status: 409 });
  if (!isBook) {
    const book = books.get(item?.bookId || body.bookId);
    if (!book || book.deleted || book.generation !== body.generation) throw new Error('示例书籍不存在');
  }
  const revision = (current?.revision || 0) + 1;
  let result;
  switch (route) {
    case 'notes/save':
    case 'notes/delete':
      notes.set(id, { id, bookId: item?.bookId || body.bookId, revision, deleted: route.endsWith('delete'), value: item ? copy(item) : null });
      result = { revision }; break;
    case 'books/save':
      result = { revision, generation: current?.generation || crypto.randomUUID() };
      books.set(id, { id, ...result, deleted: false, value: copy(item) }); break;
    case 'books/delete':
      books.set(id, { ...current, revision, deleted: true, value: null });
      for (const [key, note] of notes) if (note.bookId === id) notes.delete(key);
      result = { revision }; break;
    default: throw new Error('此操作请使用桌面版');
  }
  if (body.opId) operations.set(body.opId, copy(result));
  return result;
}
