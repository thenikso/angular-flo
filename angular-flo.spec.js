'use strict';

describe('$controllerProvider', function () {

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

	describe('controller registration', function () {

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

});
