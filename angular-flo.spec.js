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
			expect(angular.isFunction(c.getInNamed)).toBeTruthy();
			for (var i = ins.length - 1; i >= 0; i--) {
				expect(c.getInNamed(ins[i].name)).toEqual(ins[i]);
			}
			expect(angular.isFunction(c.getOutNamed)).toBeTruthy();
			for (var i = outs.length - 1; i >= 0; i--) {
				expect(c.getOutNamed(outs[i].name)).toEqual(outs[i]);
			}
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
				$componentProvider.register('test2', function() {});
			});
			expectValidComponent('test',
				[{name:'testin', type:'all'}],
				[{name:'testout', type:'all'}]);
			expectValidComponent('test2',
				[],
				[{name:'out', type:'all'}]);
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

		it('should create anonymous components', function() {
			var c = null;
			inject(function ($component) {
				c = $component(function(in1, in2){}, ['out1'])
			});
			expect(c).toBeDefined();
			expect(angular.isFunction(c)).toBeTruthy();
			expect(c.ins).toEqual([{ name:'in1', type:'all' }, { name:'in2', type:'all' }]);
			expect(c.outs).toEqual([{ name:'out1', type:'all' }]);
		});

		it('should not register an invalid component', function() {
			var componentProvider;
			module(function ($componentProvider) {
				componentProvider = $componentProvider;
			});
			inject(function() {
				expect(componentProvider.register).toThrow();
				expect(function() { componentProvider.register('name') }).toThrow();
				expect(function() { componentProvider.register(3, function(){}) }).toThrow();
				expect(function() { componentProvider.register('name', ['with space'], ['out'], function(){}) }).toThrow();
				expect(function() { componentProvider.register('name', ['equal'], ['equal'], function(){}) }).toThrow();
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
				test.typeSpy = jasmine.createSpy('typeSpy').andReturn(true);
				test.comp = getComponent('comp',
					[
						{ name:'input', type:'string' },
						{ name:'other', type:function(){
							return test.typeSpy.apply(this, arguments);
						}}
					],
					[{ name:'output', type:'string' }],
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
				expect(test.typeSpy).not.toHaveBeenCalled();
				test.inst('test', null);
				expect(test.inst).toHaveBeenCalledWith('test', null);
				expect(test.tran).toHaveBeenCalledWith('test', null);
				expect(test.typeSpy).toHaveBeenCalledWith(null);
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
				expect(test.scope.$components).toContain(test.comp);
				test.scope.$destroy();
				expect(test.scope.$components).not.toContain(test.comp);
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

describe('$network', function() {

	beforeEach(module('ngFlo'));

	var comp = null;
	var net = null;

	beforeEach(function() {
		comp = {};
		comp.one = jasmine.createSpy('compOne');
		comp.two = jasmine.createSpy('compTwo');
		module(function ($componentProvider) {
			$componentProvider.register('one', function(in1, in2) {
				comp.one(in1, in2);
				return in1;
			});
			$componentProvider.register('two', function(in1, in2) {
				comp.two(in1, in2);
				return in2;
			});
		});
		inject(function($network) {
			net = $network('test');
		});
	});

	it('should be created valid and empty', function() {
  	expect(net).toBeDefined();
  	expect(net.$scope.$watch).toBeDefined();
  	expect(net.$scope.$processes).toEqual({});
  	expect(net.$scope.$connections).toEqual({});
	});

	describe('processes', function() {

		it('should be added when valid', function() {
			net.process('p1', 'one');
			expect(net.$scope.$processes.p1).toBeDefined();
			expect(comp.one).not.toHaveBeenCalled();
			expect(function() { net.process() }).toThrow();
			expect(function() { net.process('p1', 'notacomp') }).toThrow();
		});

		it('should be successfully probed', function() {
			var probe = jasmine.createSpy('probe');
			net.process('p1', 'one');
			net.probe('p1.out', function (val) {
				probe(val);
			});
			net.$scope.$digest();
			expect(comp.one).toHaveBeenCalledWith(undefined, undefined);
			expect(probe).toHaveBeenCalledWith(undefined);
			net.$scope.$processes.p1.in1 = 'foo';
			net.$scope.$digest();
			expect(comp.one).toHaveBeenCalledWith('foo', undefined);
			expect(probe).toHaveBeenCalledWith('foo');
		});

	});

	describe('connections', function() {

		var probe;

		beforeEach(function() {
		  probe = jasmine.createSpy('probe');
		  net.process('p1', 'one');
		  net.process('p2', 'two');
		  net.connection('p1.out', 'p2.in2');
		  net.probe('p2.out', function (val) {
		  	probe(val);
		  });
		});

		it('should connect processes', function() {
			net.$scope.$digest();
			expect(comp.one).toHaveBeenCalledWith(undefined, undefined);
			expect(comp.two).toHaveBeenCalledWith(undefined, undefined);
			expect(probe).toHaveBeenCalledWith(undefined);
			net.$scope.$processes.p1.in1 = 'foo';
			net.$scope.$digest();
			expect(comp.one).toHaveBeenCalledWith('foo', undefined);
			expect(comp.two).toHaveBeenCalledWith(undefined, 'foo');
			expect(probe).toHaveBeenCalledWith('foo');
		});

		it('should throw if invalid', function() {
			expect(function() { net.connection('p1.out', 'p2.in2') }).toThrow();
			expect(function() { net.connection('p1.invalidout', 'p2.in1') }).toThrow();
		});

	});

});
