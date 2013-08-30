(function(angular, window, document, undefined) {'use strict';

var TYPE_ANY = 'all';

var flo = angular.module('ngFlo', []);

flo.provider('$component', ['$injector', function($injector) {
	var components = {};

	var componentProvider = {
		// componentProvider.register('mycomp', function(inOne, inTWo){}, ['outOne'])
		// componentProvider.register('mycomp', [{name:'inOne', type:'string'}, inTWo], ['outOne'], function(inOne, inTWo){})
		register: function(name, ins, outs, transformer) {
			if (angular.isObject(name)) {
				angular.extend(components, name)
				return componentProvider;
			}
			if (!angular.isString(name)) {
				throw "componentProvider: name should be a string";
				return componentProvider;
			}
			if (angular.isFunction(ins)) {
				transformer = decorateComponentTransformer(ins)
				ins = undefined
			}
			if (!angular.isObject(ins)) {
				ins = transformer.$ins;
			}
			if (!angular.isObject(outs)) {
				outs = transformer.$outs;
			}
			components[name] = {
				ins: ins,
				outs: outs,
				transformer: transformer
			};
			return componentProvider;
		},

		$get: function() {
			return function(name, locals) {
				var options = components[name];
				if (!angular.isObject(options)) {
					throw "$component: No component '" + name + "' found.";
				}

				// Get ins watcher expression
				var insExp = buildInsExpression(options.ins);

				// Build instantiable component
				var transformer = options.transformer;
				var instance = function(scope, portsAlias) {
					// TODO use portsAlias to rename ports
					if (angular.isFunction(options.compile)) {
						// TODO throw if transformer is set
						transformer = $injector.invoke(options.compile, options, locals);
						// TODO throw if transformer is not a function
					}
					// Validate transformer outputs
					function component() {
						var ins = parseInput(options.ins, arguments);
						var outs = transformer.apply(scope, ins); // todo should this be the scope? what when it $destroy?
						return parseOutput(options.outs, outs);
					};
					// Apply wathers to scope
					if (insExp) {
						scope.$watchCollection(insExp, function(ins, oldIns) {
							// Get outputs
							var outs = component.apply(scope, ins);
							// Push output to scope
							angular.extend(scope, outs);
						});
					}
					// Remove componet on scope destroy
					scope.$component = instance;
					scope.$on('$destroy', function() {
						scope.$component = null;
						// TODO needed?
					});
					//
					return component;
				}

				// Add metadata to component isntance
				instance.ins = angular.copy(options.ins);
				instance.outs = options.outs ? angular.copy(options.outs) : [];

				return instance;
			}
		}
	};

	return componentProvider;

	function buildInsExpression(ins) {
		var insExp = null;
		if (angular.isArray(ins)) {
			insExp = '[';
			for (var name, i = ins.length - 1; i >= 0; i--) {
				name = ins[i];
				if (angular.isObject(name)) name = name.name;
				insExp += name + ',';
			}
			if (insExp.length > 1) {
				insExp = insExp.substr(0, insExp.length - 1);
				insExp += ']';
			} else {
				insExp = null;
			}
		}
		return insExp
	}

	function parseInput(ins, values) {
		if (!angular.isArray(ins)) {
			return values;
		}
		var validated = [];
		for (var port, i = ins.length - 1; i >= 0; i--) {
			port = ins[i];
			if (angular.isObject(port)) {
				checkPortType(port, values[i]);
			}
			validated.push(values[i]);
		}
		return validated;
	}

	function parseOutput(outs, value) {
		if (!angular.isObject(value)) {
			value = {
				out: value
			};
		}
		if (!angular.isArray(outs)) {
			return value;
		}
		var validated = {};
		for (var port, name, i = outs.length - 1; i >= 0; i--) {
			port = name = outs[i];
			if (angular.isObject(port)) {
				name = port.name; // TODO check for presence
				checkPortType(port, value[name]);
			}
			validated[name] = value[name];
		}
		return validated;
	}

	function checkPortType(port, value) {
		if(angular.isString(port.type) && port.type != TYPE_ANY
		&& angular.isDefined(value) && typeof value != port.type) {
			throw "Type error!! TODO make me better: " + port.name;
		}
	}
}]);

flo.provider('$network', function() {

	function network($rootScope, $parse, $component, name, graph) {
		this.$scope = $rootScope.$new(true);
		this.$parse = $parse;
		this.$component = $component;

		this.$scope.name = name;
		this.$scope.processes = {};
		this.$scope.connections = [];
		this.$scope.graph = graph;
		// TODO watch/parse graph if present
	}

	network.prototype.process = function(name, component, portsAlias) {
		// Get component
		if (angular.isString(component)) {
			component = this.$component(component);
		}
		if (!angular.isFunction(component)) {
			throw "$network: Invalid component: " + component;
		}
		// Destroy previous process if present
		var oldProcess = this.$scope.processes[name];
		if (angular.isDefined(oldProcess)) {
			oldProcess.$destroy();
		}
		// Create new process
		var processScope = this.$scope.$new(true);
		this.$scope.processes[name] = processScope;
		// Initalize component
		component(processScope, portsAlias);
		return this;
	};

	network.prototype.connection = function(from, to) {
		// TODO sanity check of form, to
		// TODO dont like the 'processes.' + to ...
		var self = this;
		var wire = this.$parse('processes.' + to).assign;
		var endConnection = this.$scope.$watch('processes.' + from, function(value) {
			// self.$scope.$apply(function() {
				wire(self.$scope, value);
			// });
		});
		var connection = {
			from: from,
			to: to,
			$destroy: endConnection
		};
		this.$scope.connections.push(connection);
		return this;
	};

	var networkProvider = {
		$get: ['$rootScope', '$parse', '$component', function($rootScope, $parse, $component) {
			return function(name, graph) {
				return new network($rootScope, $parse, $component, name, graph);
			};
		}]
	}

	return networkProvider;
});

flo.directive('floNetwork', function() {
	return {
		restrict: 'EAC',
		compile: function(scope, element, transclude) {
			return function(scope, element, args) {

			}
		}
	};
});

})(angular, window, document);

angular.element(document).find('head').prepend('<style type="text/css">@charset "UTF-8";[flo\\:network],[flo-network],[data-flo-network],[x-flo-network],.flo-network,.x-flo-network{display:none !important;}</style>');
