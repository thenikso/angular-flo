'use strict';

describe('$controllerProvider', function () {

	beforeEach(module('ngFlo'));

	it('should register a component with standard notation', function () {
		module(function ($componentProvider) {
			$componentProvider.register('test', ['testin'], ['testout'], function() {});
		});
		inject(function($component) {
			expect($component('test')).toBeDefined();
		});
	});
});
