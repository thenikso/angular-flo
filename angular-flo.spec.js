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

	});

});
