import { describe, it, expect } from 'vitest';
import { getExpenseCategory } from './expenseIcon';

describe('Expense Icon Domain Logic', () => {
  it('correctly maps "Pizza with friends" to FOOD', () => {
    expect(getExpenseCategory('Pizza with friends')).toBe('FOOD');
  });

  it('correctly maps "Coffee with Alex" to COFFEE', () => {
    expect(getExpenseCategory('Coffee with Alex')).toBe('COFFEE');
  });

  it('correctly maps "Uber to airport" to TRANSPORT', () => {
    expect(getExpenseCategory('Uber to airport')).toBe('TRANSPORT');
  });

  it('correctly maps "Petrol for car" to FUEL', () => {
    expect(getExpenseCategory('Petrol for car')).toBe('FUEL');
  });

  it('correctly maps "Hotel in Mumbai" to HOTEL', () => {
    expect(getExpenseCategory('Hotel in Mumbai')).toBe('HOTEL');
  });

  it('correctly maps "Movie tickets" to ENTERTAINMENT', () => {
    expect(getExpenseCategory('Movie tickets')).toBe('ENTERTAINMENT');
  });

  it('correctly maps "Birthday gift" to GIFT', () => {
    expect(getExpenseCategory('Birthday gift')).toBe('GIFT');
  });

  it('correctly maps "Gym membership" to GYM', () => {
    expect(getExpenseCategory('Gym membership')).toBe('GYM');
  });

  it('correctly maps "Random expense" to OTHER', () => {
    expect(getExpenseCategory('Random expense')).toBe('OTHER');
  });

  it('is case-insensitive', () => {
    expect(getExpenseCategory('pIzZa')).toBe('FOOD');
    expect(getExpenseCategory('AIRPORT')).toBe('FLIGHT');
  });

  it('handles empty or null descriptions', () => {
    expect(getExpenseCategory('')).toBe('OTHER');
  });

  it('handles punctuation', () => {
    expect(getExpenseCategory('McDonald\'s (Burger)')).toBe('FOOD');
  });
});
