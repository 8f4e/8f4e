import { beforeEach, describe, expect, it, vi } from 'vitest';

import createStateManager from './index';

// Test interface for state manager with deep nesting
interface TestState {
	name: string;
	age: number;
	settings: {
		theme: string;
		notifications: boolean;
		preferences: {
			language: string;
			timezone: string;
			display: {
				fontSize: number;
				animations: boolean;
				accessibility: {
					highContrast: boolean;
					screenReader: boolean;
				};
			};
		};
	};
	items: string[];
	user: {
		profile: {
			personal: {
				firstName: string;
				lastName: string;
				contact: {
					email: string;
					phone: string;
					address: {
						street: string;
						city: string;
						country: string;
					};
				};
			};
		};
	};
	optionalValue?: string | null;
}

describe('StateManager', () => {
	let stateManager: ReturnType<typeof createStateManager<TestState>>;
	let initialState: TestState;

	beforeEach(() => {
		initialState = {
			name: 'John Doe',
			age: 30,
			settings: {
				theme: 'dark',
				notifications: true,
				preferences: {
					language: 'en',
					timezone: 'UTC',
					display: {
						fontSize: 14,
						animations: true,
						accessibility: {
							highContrast: false,
							screenReader: false,
						},
					},
				},
			},
			items: ['item1', 'item2'],
			user: {
				profile: {
					personal: {
						firstName: 'John',
						lastName: 'Doe',
						contact: {
							email: 'john@example.com',
							phone: '+1234567890',
							address: {
								street: '123 Main St',
								city: 'New York',
								country: 'USA',
							},
						},
					},
				},
			},
		};

		stateManager = createStateManager(initialState);
	});

	describe('getState', () => {
		it('should return the current state', () => {
			const state = stateManager.getState();
			expect(state).toEqual(initialState);
		});

		it('should return the same reference', () => {
			const state1 = stateManager.getState();
			const state2 = stateManager.getState();
			expect(state1).toBe(state2);
		});
	});

	describe('set', () => {
		it('should update top-level properties', () => {
			stateManager.set('name', 'Jane Doe');
			expect(stateManager.getState().name).toBe('Jane Doe');
		});

		it('should update nested properties', () => {
			stateManager.set('settings.theme', 'light');
			expect(stateManager.getState().settings.theme).toBe('light');
		});

		it('should update array properties', () => {
			stateManager.set('items', ['newItem1', 'newItem2']);
			expect(stateManager.getState().items).toEqual(['newItem1', 'newItem2']);
		});

		it('should maintain type safety', () => {
			stateManager.set('age', 25);
			stateManager.set('settings.notifications', false);
			stateManager.set('name', 'Test Name');
		});

		it('should support deep nesting (3 levels)', () => {
			stateManager.set('settings.preferences.language', 'es');
			expect(stateManager.getState().settings.preferences.language).toBe('es');
		});

		it('should support deep nesting (4 levels)', () => {
			stateManager.set('settings.preferences.display.fontSize', 16);
			expect(stateManager.getState().settings.preferences.display.fontSize).toBe(16);
		});

		it('should support deep nesting (5 levels)', () => {
			stateManager.set('settings.preferences.display.accessibility.highContrast', true);
			expect(stateManager.getState().settings.preferences.display.accessibility.highContrast).toBe(true);
		});

		it('should support very deep nesting (6 levels)', () => {
			stateManager.set('user.profile.personal.contact.address.city', 'Los Angeles');
			expect(stateManager.getState().user.profile.personal.contact.address.city).toBe('Los Angeles');
		});

		it('should support very deep nesting (7 levels)', () => {
			stateManager.set('user.profile.personal.contact.address.country', 'Canada');
			expect(stateManager.getState().user.profile.personal.contact.address.country).toBe('Canada');
		});
	});

	describe('subscribe', () => {
		it('should call callback when subscribed property changes', () => {
			const callback = vi.fn();
			stateManager.subscribe('name', callback);

			stateManager.set('name', 'New Name');

			expect(callback).toHaveBeenCalledWith('New Name');
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should call callback for nested property changes', () => {
			const callback = vi.fn();
			stateManager.subscribe('settings.theme', callback);

			stateManager.set('settings.theme', 'light');

			expect(callback).toHaveBeenCalledWith('light');
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should call callback for deep nested property changes (3 levels)', () => {
			const callback = vi.fn();
			stateManager.subscribe('settings.preferences.language', callback);

			stateManager.set('settings.preferences.language', 'fr');

			expect(callback).toHaveBeenCalledWith('fr');
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should call callback for deep nested property changes (4 levels)', () => {
			const callback = vi.fn();
			stateManager.subscribe('settings.preferences.display.fontSize', callback);

			stateManager.set('settings.preferences.display.fontSize', 18);

			expect(callback).toHaveBeenCalledWith(18);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should call callback for very deep nested property changes (5 levels)', () => {
			const callback = vi.fn();
			stateManager.subscribe('settings.preferences.display.accessibility.screenReader', callback);

			stateManager.set('settings.preferences.display.accessibility.screenReader', true);

			expect(callback).toHaveBeenCalledWith(true);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should call callback for very deep nested property changes (6 levels)', () => {
			const callback = vi.fn();
			stateManager.subscribe('user.profile.personal.contact.email', callback);

			stateManager.set('user.profile.personal.contact.email', 'newemail@example.com');

			expect(callback).toHaveBeenCalledWith('newemail@example.com');
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should notify parent subscriptions when nested property changes', () => {
			const preferencesCallback = vi.fn();
			const displayCallback = vi.fn();
			const fontSizeCallback = vi.fn();

			stateManager.subscribe('settings.preferences', preferencesCallback);
			stateManager.subscribe('settings.preferences.display', displayCallback);
			stateManager.subscribe('settings.preferences.display.fontSize', fontSizeCallback);

			stateManager.set('settings.preferences.display.fontSize', 24);

			expect(fontSizeCallback).toHaveBeenCalledWith(24);
			expect(fontSizeCallback).toHaveBeenCalledTimes(1);
			expect(displayCallback).toHaveBeenCalledWith(stateManager.getState().settings.preferences.display);
			expect(displayCallback).toHaveBeenCalledTimes(1);
			expect(preferencesCallback).toHaveBeenCalledWith(stateManager.getState().settings.preferences);
			expect(preferencesCallback).toHaveBeenCalledTimes(1);
		});

		it('should notify child subscriptions when parent property is replaced', () => {
			const displayCallback = vi.fn();
			const fontSizeCallback = vi.fn();
			const animationsCallback = vi.fn();

			stateManager.subscribe('settings.preferences.display', displayCallback);
			stateManager.subscribe('settings.preferences.display.fontSize', fontSizeCallback);
			stateManager.subscribe('settings.preferences.display.animations', animationsCallback);

			stateManager.set('settings.preferences.display', {
				fontSize: 30,
				animations: false,
				accessibility: stateManager.getState().settings.preferences.display.accessibility,
			});

			expect(displayCallback).toHaveBeenCalledWith(stateManager.getState().settings.preferences.display);
			expect(fontSizeCallback).toHaveBeenCalledWith(30);
			expect(animationsCallback).toHaveBeenCalledWith(false);
		});

		it('should not notify subscriptions that only partially match the path', () => {
			const partialCallback = vi.fn();
			const exactCallback = vi.fn();

			stateManager.subscribe('settings.preferences.display.font', partialCallback);
			stateManager.subscribe('settings.preferences.display.fontSize', exactCallback);

			stateManager.set('settings.preferences.display.fontSize', 20);

			expect(exactCallback).toHaveBeenCalledWith(20);
			expect(partialCallback).not.toHaveBeenCalled();
		});

		it('should not call callback for different property changes', () => {
			const callback = vi.fn();
			stateManager.subscribe('name', callback);

			stateManager.set('age', 25);
			stateManager.set('settings.theme', 'light');

			expect(callback).not.toHaveBeenCalled();
		});

		it('should call multiple callbacks for the same property', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();

			stateManager.subscribe('name', callback1);
			stateManager.subscribe('name', callback2);

			stateManager.set('name', 'New Name');

			expect(callback1).toHaveBeenCalledWith('New Name');
			expect(callback2).toHaveBeenCalledWith('New Name');
		});

		it('should return subscription object', () => {
			const callback = vi.fn();
			const subscription = stateManager.subscribe('name', callback);

			expect(subscription.selector).toBe('name');
			expect(subscription.tokens).toEqual(['name']);
			expect(subscription.callback).toBe(callback);
			expect(subscription).not.toHaveProperty('matcher');
		});
	});

	describe('unsubscribe', () => {
		it('should remove subscription and stop calling callback', () => {
			const callback = vi.fn();
			stateManager.subscribe('name', callback);

			stateManager.unsubscribe('name', callback);
			stateManager.set('name', 'New Name');

			expect(callback).not.toHaveBeenCalled();
		});

		it('should remove subscription by selector and callback', () => {
			const callback = vi.fn();

			stateManager.subscribe('name', callback);

			stateManager.unsubscribe('name', callback);
			stateManager.set('name', 'New Name');

			expect(callback).not.toHaveBeenCalled();
		});

		it('should only remove the specific subscription', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();

			stateManager.subscribe('name', callback1);
			stateManager.subscribe('name', callback2);

			stateManager.unsubscribe('name', callback1);
			stateManager.set('name', 'New Name');

			expect(callback1).not.toHaveBeenCalled();
			expect(callback2).toHaveBeenCalledWith('New Name');
		});

		it('should only remove the specific subscription by selector and callback', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();

			stateManager.subscribe('name', callback1);
			stateManager.subscribe('name', callback2);

			stateManager.unsubscribe('name', callback1);
			stateManager.set('name', 'New Name');

			expect(callback1).not.toHaveBeenCalled();
			expect(callback2).toHaveBeenCalledWith('New Name');
		});

		it('should handle unsubscribing non-existent subscription gracefully', () => {
			expect(() => {
				stateManager.unsubscribe('name', vi.fn());
			}).not.toThrow();
		});
	});

	describe('dispose', () => {
		it('removes every subscription and is idempotent', () => {
			const nameCallback = vi.fn();
			const ageCallback = vi.fn();
			stateManager.subscribe('name', nameCallback);
			stateManager.subscribeToValue('age', 31, ageCallback);

			stateManager.dispose();
			stateManager.dispose();
			stateManager.set('name', 'Jane Doe');
			stateManager.set('age', 31);

			expect(nameCallback).not.toHaveBeenCalled();
			expect(ageCallback).not.toHaveBeenCalled();
		});
	});

	describe('integration', () => {
		it('should handle complex state updates with multiple subscriptions', () => {
			const nameCallback = vi.fn();
			const ageCallback = vi.fn();
			const themeCallback = vi.fn();
			const notificationsCallback = vi.fn();

			stateManager.subscribe('name', nameCallback);
			stateManager.subscribe('age', ageCallback);
			stateManager.subscribe('settings.theme', themeCallback);
			stateManager.subscribe('settings.notifications', notificationsCallback);

			// Update multiple properties
			stateManager.set('name', 'Updated Name');
			stateManager.set('age', 35);
			stateManager.set('settings.theme', 'light');
			stateManager.set('settings.notifications', false);

			expect(nameCallback).toHaveBeenCalledWith('Updated Name');
			expect(ageCallback).toHaveBeenCalledWith(35);
			expect(themeCallback).toHaveBeenCalledWith('light');
			expect(notificationsCallback).toHaveBeenCalledWith(false);

			// Verify final state
			const finalState = stateManager.getState();
			expect(finalState.name).toBe('Updated Name');
			expect(finalState.age).toBe(35);
			expect(finalState.settings.theme).toBe('light');
			expect(finalState.settings.notifications).toBe(false);
		});

		it('should update state by direct mutation', () => {
			const callback = vi.fn();
			stateManager.subscribe('name', callback);

			// Unsubscribe
			stateManager.unsubscribe('name', callback);

			// Update state
			stateManager.set('name', 'New Name');

			// Callback should not be called since we unsubscribed
			expect(callback).not.toHaveBeenCalled();

			// State should be updated (state manager mutates state in place)
			expect(stateManager.getState().name).toBe('New Name');

			// Original state object is mutated
			expect(initialState.name).toBe('New Name');
		});
	});

	describe('type safety', () => {
		it('should enforce correct types for set operations', () => {
			// These should compile without TypeScript errors
			stateManager.set('name', 'string value');
			stateManager.set('age', 42);
			stateManager.set('settings.theme', 'dark');
			stateManager.set('settings.notifications', true);
			stateManager.set('items', ['array', 'of', 'strings']);
		});

		it('should enforce correct types for subscription callbacks', () => {
			// These should compile without TypeScript errors
			stateManager.subscribe('name', (value: string) => {
				expect(typeof value).toBe('string');
			});

			stateManager.subscribe('age', (value: number) => {
				expect(typeof value).toBe('number');
			});

			stateManager.subscribe('settings.theme', (value: string) => {
				expect(typeof value).toBe('string');
			});

			stateManager.subscribe('settings.notifications', (value: boolean) => {
				expect(typeof value).toBe('boolean');
			});

			stateManager.subscribe('items', (value: string[]) => {
				expect(Array.isArray(value)).toBe(true);
			});
		});

		it('should enforce correct types for deep nested subscription callbacks', () => {
			// These should compile without TypeScript errors and have proper type inference
			stateManager.subscribe('settings.preferences.language', (value: string) => {
				expect(typeof value).toBe('string');
			});

			stateManager.subscribe('settings.preferences.display.fontSize', (value: number) => {
				expect(typeof value).toBe('number');
			});

			stateManager.subscribe('settings.preferences.display.animations', (value: boolean) => {
				expect(typeof value).toBe('boolean');
			});

			stateManager.subscribe('settings.preferences.display.accessibility.highContrast', (value: boolean) => {
				expect(typeof value).toBe('boolean');
			});

			stateManager.subscribe('user.profile.personal.firstName', (value: string) => {
				expect(typeof value).toBe('string');
			});

			stateManager.subscribe('user.profile.personal.contact.email', (value: string) => {
				expect(typeof value).toBe('string');
			});

			stateManager.subscribe('user.profile.personal.contact.address.city', (value: string) => {
				expect(typeof value).toBe('string');
			});
		});
	});

	describe('subscribeToValue', () => {
		it('should fire callback when primitive value matches', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('name', 'Jane Doe', callback);

			stateManager.set('name', 'Jane Doe');

			expect(callback).toHaveBeenCalledWith('Jane Doe');
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should not fire callback when primitive value does not match', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('name', 'Jane Doe', callback);

			stateManager.set('name', 'John Smith');
			stateManager.set('name', 'Another Name');

			expect(callback).not.toHaveBeenCalled();
		});

		it('should fire callback when predicate returns true', () => {
			const callback = vi.fn();
			const matcher = (value: number) => value > 35;
			stateManager.subscribeToValue('age', matcher, callback);

			stateManager.set('age', 40);

			expect(callback).toHaveBeenCalledWith(40);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should not fire callback when predicate returns false', () => {
			const callback = vi.fn();
			const matcher = (value: number) => value > 35;
			stateManager.subscribeToValue('age', matcher, callback);

			stateManager.set('age', 30);
			stateManager.set('age', 25);

			expect(callback).not.toHaveBeenCalled();
		});

		it('should fire callback multiple times when value matches multiple times', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('age', 40, callback);

			stateManager.set('age', 40);
			stateManager.set('age', 35);
			stateManager.set('age', 40);

			expect(callback).toHaveBeenCalledWith(40);
			expect(callback).toHaveBeenCalledTimes(2);
		});

		it('should work with nested properties and primitive matching', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('settings.theme', 'light', callback);

			stateManager.set('settings.theme', 'light');

			expect(callback).toHaveBeenCalledWith('light');
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should work with nested properties and predicate matching', () => {
			const callback = vi.fn();
			const matcher = (value: number) => value >= 16;
			stateManager.subscribeToValue('settings.preferences.display.fontSize', matcher, callback);

			stateManager.set('settings.preferences.display.fontSize', 18);

			expect(callback).toHaveBeenCalledWith(18);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should work with deeply nested properties', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('user.profile.personal.contact.address.city', 'Los Angeles', callback);

			stateManager.set('user.profile.personal.contact.address.city', 'Los Angeles');

			expect(callback).toHaveBeenCalledWith('Los Angeles');
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should unsubscribe correctly with unsubscribe', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('age', 45, callback);

			stateManager.unsubscribe('age', callback);
			stateManager.set('age', 45);

			expect(callback).not.toHaveBeenCalled();
		});

		it('should support multiple subscribeToValue on the same property with different matchers', () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();
			const callback3 = vi.fn();

			stateManager.subscribeToValue('age', 40, callback1);
			stateManager.subscribeToValue('age', (value: number) => value > 35, callback2);
			stateManager.subscribeToValue('age', (value: number) => value < 30, callback3);

			stateManager.set('age', 40);

			expect(callback1).toHaveBeenCalledWith(40);
			expect(callback2).toHaveBeenCalledWith(40);
			expect(callback3).not.toHaveBeenCalled();
		});

		it('should not interfere with regular subscribe callbacks', () => {
			const regularCallback = vi.fn();
			const valueCallback = vi.fn();

			stateManager.subscribe('age', regularCallback);
			stateManager.subscribeToValue('age', 40, valueCallback);

			stateManager.set('age', 35);

			expect(regularCallback).toHaveBeenCalledWith(35);
			expect(valueCallback).not.toHaveBeenCalled();

			stateManager.set('age', 40);

			expect(regularCallback).toHaveBeenCalledWith(40);
			expect(regularCallback).toHaveBeenCalledTimes(2);
			expect(valueCallback).toHaveBeenCalledWith(40);
			expect(valueCallback).toHaveBeenCalledTimes(1);
		});

		it('should use strict equality for primitive matching', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('age', 30, callback);

			// Current value is 30, so it should match
			stateManager.set('age', 30);

			expect(callback).toHaveBeenCalledWith(30);
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should return subscription object', () => {
			const callback = vi.fn();
			const matcher = (value: string) => value.startsWith('J');
			const subscription = stateManager.subscribeToValue('name', matcher, callback);

			expect(subscription.selector).toBe('name');
			expect(subscription.tokens).toEqual(['name']);
			expect(subscription.callback).toBe(callback);
			expect(subscription.matcher).toBe(matcher);
		});

		it('should handle boolean primitive matching', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('settings.notifications', false, callback);

			stateManager.set('settings.notifications', false);

			expect(callback).toHaveBeenCalledWith(false);
			expect(callback).toHaveBeenCalledTimes(1);

			stateManager.set('settings.notifications', true);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should handle string predicate matching', () => {
			const callback = vi.fn();
			const matcher = (value: string) => value.includes('Doe');
			stateManager.subscribeToValue('name', matcher, callback);

			stateManager.set('name', 'Jane Doe');

			expect(callback).toHaveBeenCalledWith('Jane Doe');
			expect(callback).toHaveBeenCalledTimes(1);

			stateManager.set('name', 'John Smith');

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should notify parent subscriptions but only fire when matcher matches', () => {
			const parentCallback = vi.fn();
			const valueCallback = vi.fn();

			stateManager.subscribe('settings.preferences', parentCallback);
			stateManager.subscribeToValue('settings.preferences.display.fontSize', 20, valueCallback);

			stateManager.set('settings.preferences.display.fontSize', 18);

			expect(parentCallback).toHaveBeenCalledWith(stateManager.getState().settings.preferences);
			expect(valueCallback).not.toHaveBeenCalled();

			stateManager.set('settings.preferences.display.fontSize', 20);

			expect(parentCallback).toHaveBeenCalledTimes(2);
			expect(valueCallback).toHaveBeenCalledWith(20);
			expect(valueCallback).toHaveBeenCalledTimes(1);
		});

		it('should handle falsy primitive values - zero', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('age', 0, callback);

			stateManager.set('age', 0);

			expect(callback).toHaveBeenCalledWith(0);
			expect(callback).toHaveBeenCalledTimes(1);

			stateManager.set('age', 5);

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should handle falsy primitive values - empty string', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('name', '', callback);

			stateManager.set('name', '');

			expect(callback).toHaveBeenCalledWith('');
			expect(callback).toHaveBeenCalledTimes(1);

			stateManager.set('name', 'Non-empty');

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should handle null values', () => {
			const callback = vi.fn();
			stateManager.subscribeToValue('optionalValue', null, callback);

			stateManager.set('optionalValue', null);

			expect(callback).toHaveBeenCalledWith(null);
			expect(callback).toHaveBeenCalledTimes(1);

			stateManager.set('optionalValue', 'Not null');

			expect(callback).toHaveBeenCalledTimes(1);
		});

		it('should handle undefined values', () => {
			const callback = vi.fn();
			const subscription = stateManager.subscribeToValue('optionalValue', undefined, callback);
			expect(subscription).toHaveProperty('matcher', undefined);

			stateManager.set('optionalValue', undefined);

			expect(callback).toHaveBeenCalledWith(undefined);
			expect(callback).toHaveBeenCalledTimes(1);

			stateManager.set('optionalValue', 'Not undefined');

			expect(callback).toHaveBeenCalledTimes(1);
		});
	});

	describe('subscription path compatibility', () => {
		it('matches each subscribed target after leaf updates and parent replacements', () => {
			const parentCallback = vi.fn();
			const childCallback = vi.fn();
			const parentMatcher = vi.fn(
				(display: TestState['settings']['preferences']['display']) => display.fontSize === 20
			);
			stateManager.subscribeToValue('settings.preferences.display', parentMatcher, parentCallback);
			stateManager.subscribeToValue('settings.preferences.display.fontSize', 20, childCallback);

			stateManager.set('settings.preferences.display.fontSize', 18);
			expect(parentMatcher).toHaveBeenLastCalledWith(initialState.settings.preferences.display);
			expect(parentCallback).not.toHaveBeenCalled();
			expect(childCallback).not.toHaveBeenCalled();

			const replacement = { ...initialState.settings.preferences.display, fontSize: 20 };
			stateManager.set('settings.preferences.display', replacement);
			// Reassigning an unchanged parent still notifies matching subscribers.
			stateManager.set('settings.preferences.display', replacement);
			expect(parentMatcher).toHaveBeenCalledTimes(3);
			expect(parentCallback.mock.calls).toEqual([[replacement], [replacement]]);
			expect(childCallback.mock.calls).toEqual([[20], [20]]);
		});

		it.each([null, undefined, {}, 'text', 42, false])(
			'notifies children with undefined when their parent becomes %s',
			branch => {
				const manager = createStateManager<{ branch: unknown }>({ branch: { child: { value: 1 } } });
				const regularCallback = vi.fn();
				const valueCallback = vi.fn();
				manager.subscribe('branch.child.value', regularCallback);
				manager.subscribeToValue('branch.child.value', undefined, valueCallback);

				manager.set('branch', branch);
				expect(regularCallback.mock.calls).toEqual([[undefined]]);
				expect(valueCallback.mock.calls).toEqual([[undefined]]);
			}
		);

		it('does not read boxed properties from primitive targets', () => {
			const manager = createStateManager<{ branch: unknown }>({ branch: { length: 4 } });
			const callback = vi.fn();
			manager.subscribe('branch.length', callback);
			manager.set('branch', 'text');
			expect(callback.mock.calls).toEqual([[undefined]]);
		});

		it('reads properties on functions when a parent is replaced', () => {
			const manager = createStateManager<{ branch: unknown }>({ branch: null });
			const callback = vi.fn();
			manager.subscribe('branch.child.value', callback);
			manager.set(
				'branch',
				Object.assign(() => false, { child: { value: 42 } })
			);
			expect(callback.mock.calls).toEqual([[42]]);
		});

		it('preserves array indices and empty path segments', () => {
			const manager = createStateManager({ items: [{ value: 1 }], branch: { '': { value: 2 } }, '': 3 });
			const arrayCallback = vi.fn();
			const emptySegmentCallback = vi.fn();
			const emptySelectorCallback = vi.fn();
			manager.subscribe('items.0.value', arrayCallback);
			manager.subscribe('branch..value', emptySegmentCallback);
			manager.subscribe('', emptySelectorCallback);

			manager.set('items', [{ value: 4 }]);
			manager.set('branch..value', 5);
			manager.set('', 6);
			expect(arrayCallback.mock.calls).toEqual([[4]]);
			expect(emptySegmentCallback.mock.calls).toEqual([[5]]);
			expect(emptySelectorCallback.mock.calls).toEqual([[6]]);
		});

		it('treats an identical function matcher as a value and other functions as predicate inputs', () => {
			const matcher = vi.fn(() => false);
			const other = () => true;
			const manager = createStateManager({ nested: { handler: other } });
			const callback = vi.fn();
			manager.subscribeToValue('nested.handler', matcher, callback);

			manager.set('nested.handler', matcher);
			expect(callback.mock.calls).toEqual([[matcher]]);
			expect(matcher).not.toHaveBeenCalled();

			manager.set('nested', { handler: other });
			expect(matcher).toHaveBeenLastCalledWith(other);
			expect(callback).toHaveBeenCalledTimes(1);

			matcher.mockReturnValue(true);
			manager.set('nested.handler', other);
			expect(matcher).toHaveBeenCalledTimes(2);
			expect(callback.mock.calls).toEqual([[matcher], [other]]);
		});
	});
});
