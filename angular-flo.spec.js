'use strict';

describe('$controller', function () {

	beforeEach(module('ngFlo'));

	function expectValidComponent(name, ins, outs) {
		inject(function($component) {
			var c = $component(name);
			expect(c).toBeDefined();
			expect(angular.isFunction(c)).toBeTruthy();
			expect(c.ins).toEqual(ins);
			expect(c.outs).toEqual(outs);
		});
	}

	function getComponent(name) {
		var args = arguments;
		module(function ($componentProvider) {
			$componentProvider.register.apply(null, args);
		});
		var c = null;
		inject(function($component) {
			c = $component(name);
		});
		return c;
	}

	function getNewScope() {
		var scope = null;
		inject(function($rootScope) {
			scope = $rootScope.$new(true);
		});
		return scope;
	}

	describe('registration', function () {

		it('should register a component with standard notation', function () {
			module(function ($componentProvider) {
				$componentProvider.register('test', ['testin'], ['testout'], function() {});
				$componentProvider.register('test2',
					[{name:'testin', type:'number'}, {name:'testin2', type:'all'}],
					[{name:'testout', type:'string'}, 'testout2'],
					function() {});
			});
			expectValidComponent('test',
				[{name:'testin', type:'all'}],
				[{name:'testout', type:'all'}]);
			expectValidComponent('test2',
				[{name:'testin', type:'number'}, {name:'testin2', type:'all'}],
				[{name:'testout', type:'string'}, {name:'testout2', type:'all'}]);
		});

		it('should register a component with abreviated notation', function () {
			module(function ($componentProvider) {
				$componentProvider.register('test', function(testin) {}, ['testout']);
			});
			expectValidComponent('test',
				[{name:'testin', type:'all'}],
				[{name:'testout', type:'all'}]);
		});

		it('should register a component with decorated notation', function () {
			module(function ($componentProvider) {
				var transformer = function(testin){};
				transformer.$ins = ['decoratedin'];
				transformer.$outs = [{ name:'decoratedout', type:'none' }];
				$componentProvider.register('test', transformer);
			});
			expectValidComponent('test',
				[{name:'decoratedin', type:'all'}],
				[{ name:'decoratedout', type:'none' }]);
		});

		it('should register a component with object notation', function () {
			module(function ($componentProvider) {
				$componentProvider.register({
					'test': {
						ins: ['testin'],
						outs: ['testout'],
						transformer: function() {}
					},
					'test2': {
						ins: [{name:'testin', type:'number'}, {name:'testin2', type:'all'}],
						outs: [{name:'testout', type:'string'}, 'testout2'],
						compile: function() {}
					}
				});
			});
			expectValidComponent('test',
				[{name:'testin', type:'all'}],
				[{name:'testout', type:'all'}]);
			expectValidComponent('test2',
				[{name:'testin', type:'number'}, {name:'testin2', type:'all'}],
				[{name:'testout', type:'string'}, {name:'testout2', type:'all'}]);
		});

		it('should not register an invalid component', function() {
			module(function ($componentProvider) {
				expect($componentProvider.register).toThrow();
				expect(function() { $componentProvider.register('name') }).toThrow();
				expect(function() { $componentProvider.register(3, function(){}) }).toThrow();
			});
		});

	});

	describe('transformer', function() {

		var test = null;

		describe('with input/output specified', function() {

			beforeEach(function() {
				test = {};
				test.tran = function(input, other) {
					if (other) return other;
					if (input) return input.toUpperCase();
				};
				test.comp = getComponent('comp',
					[{ name: 'input', type:'string' }, 'other'],
					[{ name: 'output', type:'string' }],
					function() { return test.tran.apply(this, arguments) });
				test.scope = null;
				test.inst = test.comp(test.scope);
				spyOn(test, 'inst').andCallThrough();
				spyOn(test, 'tran').andCallThrough();
			});

			it('should not have been called uppon creation', function() {
				expect(test.tran).not.toHaveBeenCalled();
			});

			it('should be called with valid input', function() {
				test.inst('test');
				expect(test.inst).toHaveBeenCalledWith('test');
				expect(test.tran).toHaveBeenCalledWith('test', undefined);
				test.inst('test', null);
				expect(test.inst).toHaveBeenCalledWith('test', null);
				expect(test.tran).toHaveBeenCalledWith('test', null);
				test.inst(null);
				expect(test.inst).toHaveBeenCalledWith(null);
				expect(test.tran).toHaveBeenCalledWith(null, undefined);
				test.inst();
				expect(test.inst).toHaveBeenCalledWith();
				expect(test.tran).toHaveBeenCalledWith(undefined, undefined);
			});

			it('should throw if called with invalid input', function() {
				expect(function() { test.inst(1) }).toThrow();
			});

			it('should always return an object', function() {
				expect(angular.isObject(test.inst('test'))).toBeTruthy();
				expect(angular.isObject(test.inst(null, { a:3 }))).toBeTruthy();
			});

			it('should return a valid, minimal output', function() {
				var out = test.inst('test');
				expect(test.inst.calls.length).toEqual(1);
				expect(test.tran.calls.length).toEqual(1);
				expect(out).toEqual({ output:'TEST' });
				expect(test.inst()).toEqual({});
				expect(test.inst(null, { no:'out' })).toEqual({});
				expect(test.inst(null, { output:'out' })).toEqual({ output:'out' });
			});

			it('should throw if returning invalid output', function() {
				expect(function() { test.inst(null, { output:3 }) }).toThrow();
			});

		});

		describe('attached to a scope', function() {

			beforeEach(function() {
				test = {};
				test.trans = function(input, other) {
					if (other) return other;
					if (input) return input.toUpperCase();
				};
				test.comp = getComponent('comp', function(input, other) {
						return test.trans(input, other);
					}, ['output']);
				test.scope = getNewScope();
				test.outputWatcher = jasmine.createSpy('outputWatcher');
				spyOn(test, 'trans').andCallThrough();
			});

			afterEach(function() {
				test.scope.$destroy();
				test = null;
			});

			it('should insert and remove iself from the scope', function() {
				test.inst = test.comp(test.scope);
				expect(test.scope.$component).toEqual(test.comp);
				test.scope.$destroy();
				expect(test.scope.$component).not.toBeDefined();
			});

			it('should watch the scope for inputs with option noInhibition', function() {
				expect(test.scope.$$watchers).toBe(null);
				test.inst = test.comp(test.scope, { noInhibition:true });
				expect(test.trans).not.toHaveBeenCalled();
				expect(test.scope.$$watchers.length).toEqual(1);
				test.scope.$digest();
				expect(test.trans).toHaveBeenCalledWith(undefined, undefined);
			});

			it('should not execute if no output is beein directly watched', function() {
				test.inst = test.comp(test.scope);
				expect(test.trans).not.toHaveBeenCalled();
				test.scope.$digest();
				expect(test.trans).not.toHaveBeenCalled();
			});

			it('should execute on watched input changes', function() {
				test.inst = test.comp(test.scope);
				test.scope.$watch('output', function(val, oldVal) {
					test.outputWatcher(val, oldVal);
				});
				test.scope.$digest();
				expect(test.trans).toHaveBeenCalledWith(undefined, undefined);
				expect(test.outputWatcher).toHaveBeenCalledWith(undefined, undefined);
				test.scope.input = 'test';
				test.scope.$digest();
				expect(test.trans).toHaveBeenCalledWith('test', undefined);
				expect(test.outputWatcher).toHaveBeenCalledWith('TEST', undefined);
				test.scope.$digest();
				expect(test.trans.calls.length).toEqual(2);
				expect(test.outputWatcher.calls.length).toEqual(2);
				test.scope.input = 'test2';
				test.scope.$digest();
				expect(test.trans).toHaveBeenCalledWith('test2', undefined);
				expect(test.outputWatcher).toHaveBeenCalledWith('TEST2', 'TEST');
			});

			it('should inhibit when all output watchers are removed', function() {
				test.inst = test.comp(test.scope);
				var endwather = test.scope.$watch('output', function(val, oldVal) {
					test.outputWatcher(val, oldVal);
				});
				test.scope.$digest();
				expect(test.trans).toHaveBeenCalled();
				expect(test.outputWatcher).toHaveBeenCalled();
				endwather();
				test.scope.input = 'test';
				test.scope.$digest();
				expect(test.trans.calls.length).toEqual(1);
				expect(test.outputWatcher.calls.length).toEqual(1);
			});

		});

	});

});
