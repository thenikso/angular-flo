# Angular Flo

Angular Flo provides your [AngularJS](http://angularjs.org) web app with services and directives to use [Flow Based Programming](http://en.wikipedia.org/wiki/Flow-based_programming) paradigm. This will simplify or even entirely remove Javascript code in your controllers and custom directives.

## Usage

First of all, include `angular-flo.js` in your HTML file. Angular Flo requires AngularJS version 1.2.0rc1 or above.


```
 <script src="https://ajax.googleapis.com/ajax/libs/angularjs/1.2.0rc1/angular.min.js"></script>
 <script src="angular-flo.js"></script>
```

You may also want to include some component collection modules or [create your own](#$componentProvider).

```
 TODO
```

The `flo-network` directive can now be used to specify networks directly in the HTML file using the [FPB]() domain-specific language.

```
 <flo-network name="salute"
              import="{ 'Join.first': myName }"
              export="{ 'greeting': 'Shout.out' }">
 	'!!!' -> SECOND Join(strings/Join) OUT -> IN Shout(strings/UpperCase)
 </flo-network>
 
 <input type="text" ng-model="myName">
 <div>hey {{greeting}}</div>
```

### $network

Two new services are now injectable in your app: `$network` and `$component`. A network can be declared in javascript.

```
 app.controller('MyController', function($scope, $network) {
 	$network('salute')
 		.process('Join', 'strings/Join')
 		.process('Shout', 'strings/UpperCase')
 		.connection('Join.out', 'Shout.in')
 		.data('!!!', 'Join.second')
 		.import($scope, { 'Join.first': 'myName' })
 		.export($scope, { 'greeting': 'Shout.out' });
 });
```

Besides importing and exporting values from the network, it is possible to directly probe a port.

```
 net.probe('process.port', function(value, oldValue) {
 	...
 });
```

### $component

The `$component` service can be used to retrieve components and use them directly in a scope if it is not needed to connect them in a network.

```
 app.controller('MyController', function($scope, $component) {
 	// Attach a component to a scope and remap its port to local $scope properties.
 	// With the `noInhibition` option, the component will update the `myJoinedString`
 	// even if no one is watching it.
 	var joiner = $component('strings/Join')($scope, {
 		noInhibition: true,
 		portsAlias: {
 			'first': 'myFirstString',
 			'second': 'mySecondString',
 			'out': 'myJoinedString'
 		}
 	});
 	
 	// The returned joiner can also be used to execute the component transformation locally
 	// This example will return an object: { myJoinedString: 'foobar' }
 	var foobar = joiner('foo', 'bar'); 
 	
 	// Anonymous component can also be declared, this are more useful in conjunction with 
 	// networks. This example will create a component with an input port `myJoinedString` and
 	// an output port `myJoinedStringOrNot` and attach it to the scope.
 	$component(function(myJoinedString) {
 		return myJoinedString + '!?';
 	}, ['myJoinedStringOrNot'])($scope, { noInhibition: true });
 });
```

### $componentProvider

To define new reusable components they should be declared in the module configuration using `$componentProvider.register` method. There are different notations that can be used to register new components.

The **standard notation** allows the explicit declaration on input and output ports. Ports can either be objects with `name` and `validate` properties or just the name string. `validate` can be a function or a Javascript "`typeof`". The *transform* function may return an object with output port names as keys or a plain value that will be automatically mapped to the first output port.

```
 app.config(function($componentProvider) {
 	// Registering a component with the standard notation.
 	$componentProvider.register('myComponent',
 		[{ name:'firstIn', validate:'string' }, 'secondIn'],
 		[{ name:'out' }],
 		function(firstIn, secondIn) {
 			return {
 				out: firstIn+secondIn;
 			}
 		});
 });
```

The **abbreviated notation** derives input port names from the function parameters and still let you specify output ports.

```
$componentProvider.register('myComponent',
	function(firstIn, secondIn) {
		return {
			out: firstIn+secondIn;
		}
	}, ['out']);
```

The **decorated notation** will watch for `$ins` and `$outs` property on the transform function.

```
function transformer(a, b) {
	return {
		out: a+b;
	}
}
transformer.$ins = ['firstIn', { name: 'secondIn' }];
transformer.$outs = ['out'];
$componentProvider.register('myComponent', transformer);
```

Lastly, the **obejct notation** allows to specify a `compile` function that can be injected with AngularJS services and should return the transformer function.


```
$componentProvider.register({
	'myComponent': {
		ins: ['firstIn', { name: 'secondIn', validate:function(v){ return typeof v == 'string' } }],
		outs: ['out'],
		// transform: function() { … },
		compile: function($http) {
			return function(firstIn, secondIn) { … }
		}
	}
});
```

Every component defined this way will be available via `$component` using the component name.