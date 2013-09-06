'use strict';

function getNewScope() {
	var scope = null;
	inject(function($rootScope) {
		scope = $rootScope.$new(true);
	});
	return scope;
}

describe('$component', function () {

	beforeEach(module('ngFlo'));

	function expectValidComponent(name, ins, outs) {
		inject(function($component) {
			var c = $component(name);
			expect(c).toBeDefined();
			expect(angular.isFunction(c)).toBeTruthy();
			expect(c.componentName).toEqual(name);
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

	describe('registration', function () {

		it('should register a component with standard notation', function () {
			module(function ($componentProvider) {
				$componentProvider.register('test', ['testin'], ['testout'], function() {});
				$componentProvider.register('test2',
					[{name:'testin', validate:'number'}, {name:'testin2', validate:'all'}],
					[{name:'testout', validate:'string'}, 'testout2'],
					function() {});
			});
			expectValidComponent('test',
				[{name:'testin', validate:'all'}],
				[{name:'testout', validate:'all'}]);
			expectValidComponent('test2',
				[{name:'testin', validate:'number'}, {name:'testin2', validate:'all'}],
				[{name:'testout', validate:'string'}, {name:'testout2', validate:'all'}]);
		});

		it('should register a component with abreviated notation', function () {
			module(function ($componentProvider) {
				$componentProvider.register('test', function(testin) {}, ['testout']);
				$componentProvider.register('test2', function() {});
			});
			expectValidComponent('test',
				[{name:'testin', validate:'all'}],
				[{name:'testout', validate:'all'}]);
			expectValidComponent('test2',
				[],
				[{name:'out', validate:'all'}]);
		});

		it('should register a component with decorated notation', function () {
			module(function ($componentProvider) {
				var transformer = function(testin){};
				transformer.$ins = ['decoratedin'];
				transformer.$outs = [{ name:'decoratedout', validate:'none' }];
				$componentProvider.register('test', transformer);
			});
			expectValidComponent('test',
				[{name:'decoratedin', validate:'all'}],
				[{ name:'decoratedout', validate:'none' }]);
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
						ins: [{name:'testin', validate:'number'}, {name:'testin2', validate:'all'}],
						outs: [{name:'testout', validate:'string'}, 'testout2'],
						compile: function() {}
					}
				});
			});
			expectValidComponent('test',
				[{name:'testin', validate:'all'}],
				[{name:'testout', validate:'all'}]);
			expectValidComponent('test2',
				[{name:'testin', validate:'number'}, {name:'testin2', validate:'all'}],
				[{name:'testout', validate:'string'}, {name:'testout2', validate:'all'}]);
		});

		it('should create anonymous components', function() {
			var c = null;
			inject(function ($component) {
				c = $component(function(in1, in2){}, ['out1'])
			});
			expect(c).toBeDefined();
			expect(angular.isFunction(c)).toBeTruthy();
			expect(c.ins).toEqual([{ name:'in1', validate:'all' }, { name:'in2', validate:'all' }]);
			expect(c.outs).toEqual([{ name:'out1', validate:'all' }]);
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
				expect(function() { componentProvider.register('name', ['with.point'], ['out'], function(){}) }).toThrow();
				expect(function() { componentProvider.register('name', ['equal'], ['Equal'], function(){}) }).toThrow();
				expect(function() { componentProvider.register('name', ['equal', 'Equal'], ['out'], function(){}) }).toThrow();
				expect(function() { componentProvider.register('name', ['in'], ['Equal', 'equal'], function(){}) }).toThrow();
				expect(function() { componentProvider.register('name', [3], [], function(){}) }).toThrow();
			});
		});

		it('should expose the register method from $component', function() {
			var componentProvider;
			module(function ($componentProvider) {
				componentProvider = $componentProvider;
			});
			inject(function($component) {
				expect($component.register).toEqual(componentProvider.register);
			});
		});

		it('should provide a list of registered components with `name` methods', function() {
			module(function ($componentProvider) {
				$componentProvider.register('comp1', function(){});
				$componentProvider.register('comp2', function(){});
			});
			inject(function($component) {
				expect(angular.isFunction($component.names)).toBeTruthy();
				expect($component.names()).toEqual(['comp1', 'comp2']);
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
						{ name:'input', validate:'string' },
						{ name:'other', validate:function(){
							return test.typeSpy.apply(this, arguments);
						}}
					],
					[{ name:'output', validate:'string' }],
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
				expect(test.tran).toHaveBeenCalledWith('test');
				expect(test.typeSpy).not.toHaveBeenCalled();
				test.inst('test', null);
				expect(test.inst).toHaveBeenCalledWith('test', null);
				expect(test.tran).toHaveBeenCalledWith('test', null);
				expect(test.typeSpy).toHaveBeenCalledWith(null);
				test.inst(null);
				expect(test.inst).toHaveBeenCalledWith(null);
				expect(test.tran).toHaveBeenCalledWith(null);
				test.inst();
				expect(test.inst).toHaveBeenCalledWith();
				expect(test.tran).toHaveBeenCalledWith();
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
				expect(test.scope.$components).toContain(test.inst);
				test.scope.$destroy();
				expect(test.scope.$components).not.toContain(test.inst);
			});

			it('should watch the scope immediatly with `noInhibition` option', function() {
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

			it('should map port names with `portsAlias` options', function() {
				test.inst = test.comp(test.scope, {
					portsAlias: {
						"input": "in1",
						"other": "in2",
						output: "out"
					}
				});
				test.scope.in1 = "foo";
				test.scope.in2 = "bar";
				test.scope.$watch('out', function(val, oldVal) {
					test.outputWatcher(val, oldVal);
				});
				test.scope.$digest();
				expect(test.scope.output).not.toBeDefined();
				expect(test.trans).toHaveBeenCalledWith("foo", "bar");
				expect(test.outputWatcher).toHaveBeenCalledWith("bar", "bar");
			});

			it('should throw if port aliases are invalid port names', function() {
				expect(function() {
					test.comp(test.scope, {
						portsAlias: {
							"input": "in.1",
							"other": "in 2",
							output: "out"
						}
					});
				}).toThrow();
				expect(function() {
					test.comp(test.scope, {
						portsAlias: {
							"input": "in1",
							"other": "in2",
							output: "in1"
						}
					});
				}).toThrow();
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
		expect(angular.isFunction(net.probe)).toBeTruthy();
		expect(angular.isFunction(net.process)).toBeTruthy();
		expect(angular.isFunction(net.connection)).toBeTruthy();
		expect(angular.isFunction(net.data)).toBeTruthy();
		expect(angular.isFunction(net.import)).toBeTruthy();
		expect(angular.isFunction(net.export)).toBeTruthy();
		expect(angular.isFunction(net.empty)).toBeTruthy();
		expect(angular.isFunction(net.graph)).toBeTruthy();
		expect(angular.isFunction(net.fbp)).toBeTruthy();
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

		it('should connect constnt data', function() {
			net.data('foo', 'p1.in1');
			net.$scope.$digest();
			expect(comp.one).toHaveBeenCalledWith('foo', undefined);
		});

		it('should throw if invalid', function() {
			expect(function() { net.connection('p1.out', 'p2.in2') }).toThrow();
			expect(function() { net.connection('p1.invalidout', 'p2.in1') }).toThrow();
			expect(function() { net.data('foo', 'p2.in2') }).toThrow();
		});

	});

	describe('import/export', function() {

		var scope, probe;

		beforeEach(function() {
			scope = getNewScope();
			probe = jasmine.createSpy('probe');
			net.process('p1', 'one');
			net.process('p2', 'two');
			net.connection('p1.out', 'p2.in2');
			net.probe('p2.out', function (val) {
				probe(val);
			});
		});

		it('should import data from a scope', function() {
			net.import(scope, { 'p1.in1': 'localIn' });
			net.import(scope, "{ 'p1.in2': localIn2 }");
			scope.localIn = '1';
			scope.localIn2 = '2';
			scope.$digest();
			net.$scope.$digest();
			expect(comp.one).toHaveBeenCalledWith('1', '2');
		});

		it('should throw if importing data to an already connected port', function() {
			net.import(scope, { 'p2.in2': 'foo' });
			expect(function() { scope.$digest(); }).toThrow();
		});

		it('should export data to a scope', function() {
			net.data('foo', 'p1.in1');
			net.export(scope, { 'localOut':'p1.out' });
			net.export(scope, "{ 'localOut2':'p2.out' }");
			net.$scope.$digest();
			expect(scope.localOut).toEqual('foo');
			expect(scope.localOut2).toEqual('foo');
		});

	});

	describe('graph', function() {

		it('should be emptied', function() {
			net.process('p1', 'one');
			net.process('p2', 'two');
			net.connection('p1.out', 'p2.in2');
			expect(net.$scope.$processes.p1).toBeDefined();
			expect(net.$scope.$processes.p2).toBeDefined();
			expect(net.$scope.$connections['p2.in2']).toBeDefined();
			net.empty();
			expect(net.$scope.$processes.p1).not.toBeDefined();
			expect(net.$scope.$processes.p1).not.toBeDefined();
			expect(net.$scope.$connections['p2.in2']).not.toBeDefined();
		});

		it('should define a network from an object', function() {
			net.graph({
				processes: {
					'p1': { component: 'one' },
					'p2': { component: 'two' }
				},
				connections: {
					'p2.in2': { from: 'p1.out' },
					'p1.in1': { data: 'foo' }
				}
			});
			expect(net.$scope.$processes.p1).toBeDefined();
			expect(net.$scope.$processes.p2).toBeDefined();
			expect(net.$scope.$connections['p1.in1']).toBeDefined();
			expect(net.$scope.$connections['p2.in2']).toBeDefined();
			inject(function($network) {
				net = $network('Test2', {
					processes: {
						'p1': { component: 'one' },
						'p2': { component: 'two' }
					},
					connections: {
						'p2.in2': { from: 'p1.out' },
						'p1.in1': { data: 'foo' }
					}
				});
				expect(net.$scope.$processes.p1).toBeDefined();
				expect(net.$scope.$processes.p2).toBeDefined();
				expect(net.$scope.$connections['p1.in1']).toBeDefined();
				expect(net.$scope.$connections['p2.in2']).toBeDefined();
			});
		});

		it('should return the graph of the network', function() {
			net.process('p1', 'one');
			net.process('p2', 'two');
			net.connection('p1.out', 'p2.in2');
			expect(net.graph()).toEqual({
				processes: {
					'p1': { component: 'one' },
					'p2': { component: 'two' }
				},
				connections: {
					'p2.in2': { from: 'p1.out' }
				}
			});
		});

	});

	describe('fbp', function() {

		it('should define a network from an FBP string', function() {
			net.fbp("'foo' -> IN1 p1(one) OUT -> IN2 p2(two)");
			expect(net.$scope.$processes.p1).toBeDefined();
			expect(net.$scope.$processes.p2).toBeDefined();
			expect(net.$scope.$connections['p1.in1']).toBeDefined();
			expect(net.$scope.$connections['p2.in2']).toBeDefined();
		});

		// it('should return the FBP serialization of the graph', function() {
		// 	net.process('p1', 'one');
		// 	net.process('p2', 'two');
		// 	net.connection('p1.out', 'p2.in2');
		// 	net.data('foo', 'p1.in1');
		// 	expect(net.fbp()).toEqual("'foo' -> IN1 p1(one) OUT -> IN2 p2(two)");
		// });

	});

});
