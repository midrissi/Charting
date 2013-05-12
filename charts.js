var _ns = {};
/**
* This file work with this libraries:
*	=> dc.js 		: http://nickqizhu.github.io/dc.js/
*	=> d3js 		: http://www.d3js.org/
*	=> crossfilter 	: https://github.com/square/crossfilter
*/

(function(ns){
	/************************* Chart Class *************************/
	function Chart(config){
		var that = this;

		this._validate_config(config);

		this.config = $.extend(
			true,
			{
				id		: null,
				data 	: [],
				xAxis	: 'key',
				margins	: {top:10, left:30, right:30, bottom:20},
				events	: {},
				methods	: {
					round						: d3.time.minute.round,
					xUnits						: d3.time.minutes,
					brushOn						: false,
					elasticY					: true,
					transitionDuration			: 1000,
					renderHorizontalGridLines	: true
				},
				zoom	: {
					display	: true,
					type 	: 'barChart',
					height	: 75,
					methods	: {
						gap							: 0,
						round						: d3.time.minute.round,
						xUnits						: d3.time.minutes,
						position					: 'bottom',
						elasticY					: true,
						elasticX					: true,
						centerBar					: true,
						renderArea					: true,
						valueAccessor				: function(d){
							return d.value.avg;
						},
						title 						: function(d) {
							return "Value: " + d.value;
						}
					},
					events						: {
						"filtered": function (chart) {
				            dc.events.trigger(function () {
				                that.chart.focus(chart.filter());
				            });
				        }
					}
				}
			},
			config
		);

		this._init();
		this.setData(config.data);
	}

	Chart.CHART_VALIDATOR 	= new Validator({
		'data' 	: new Field({
			allowedTypes 	: ['array' , 'datasource'],
			mandatory		: true
		}),
		'id' 	: new Field({
			allowedTypes 	: ['string'],
			mandatory		: true,
			validate 		: function(value){
				var element = document.getElementById(value);
				if(element){
					return true;
				}

				Validator.throwError('INVALID_ID' , value);
			}
		}),
		'xAxis' 	: new Field({
			allowedTypes 	: ['string'],
			mandatory		: true
		}),
		'zoom.type': new Field({
			allowedTypes 	: ['string'],
			validate 		: function(value){
				var validTypes = ['barChart', 'lineChart'];
				if(validTypes.indexOf(value) < 0){
					Validator.throwError('INVALID_ZOOM_CHART_TYPE' , value, validTypes);
				}

				return true;
			}
		})
	});

	Chart.BAR_VALIDATOR = new Validator({
		'yAxis' 	: new Field({
			allowedTypes 	: ['string'],
			mandatory		: true
		})
	});

	Chart.LINE_VALIDATOR = new Validator({
		
	});
	
	/**
    * [Private method] Sets the data for the charts
    * @method setData
    * @param {Object} data 
    */
	Chart.prototype.setData = function setData(data, type){
		var that	= this,
			res 	= {
				data  : data,
				range : {
					max : null,
					min : null
				}
			},
			range 		= res.range,
			config 		= this.config;

		data.forEach(function (e) {
			e.dd 		= new Date(e[config.xAxis]*1000);
			range.min 	= range.min ? (range.min > e.dd ? e.dd : range.min) : e.dd;
			range.max 	= range.max ? (range.max < e.dd ? e.dd : range.max) : e.dd;
			e.minute 	= d3.time.minute(e.dd);
        });

		var	ndx 		= this.ndx = crossfilter(data),
			dimension 	= ndx.dimension(function (d) {
	            return d ? d.dd: null;
	        });

		config._meta = {
			dimension	: dimension,
	        cGroup		: dimension.group().reduceSum(function (d) {
	            return d ? d.value: null;
	        }),
	        zGroup : dimension.group().reduce(
	            function (p, v) {
	            	v = v || {};
	                ++p.minutes;
	                p.total += v.value;
	                p.avg = Math.round(p.total / p.minutes);
	                return p;
	            },
	            function (p, v) {
	            	v = v || {};
	                --p.minutes;
	                p.total -= v.value;
	                p.value = v.value;
	                p.avg = p.minutes == 0 ? 0 : Math.round(p.total / p.minutes);
	                return p;
	            },
	            function () {
	                return {minutes: 0, total: 0, avg: 0 , value : 0};
	            }
	        )
		}

        this
        .chart
        .dimension(dimension)
        .group(config._meta.cGroup)
        .x(d3.time.scale().domain([range.min , range.max]))

        this
        .charts
        .forEach(function(chart){
        	chart
        	.group(config._meta.cGroup);
        });

		if(config.zoom.display){
			this
	        .zoom
	        .dimension(dimension)
	        .group(config._meta.zGroup)
	        .x(d3.time.scale());

	        try{
	        	this
		        .chart
	        	.focus(this.zoom.filter());
	        }
	        catch(e){

	        }
		}

        switch(type){
        	case 'render':
        		dc.renderAll(config.id);
        		break;
        	case 'redraw':
        	case true:
        		dc.redrawAll(config.id);
        		break;
        }

        return res;
	}
	
	/**
    * [Private method] Validates the config (for the Chart constructor and line/bar methods)
    * @method _validate_config
    * @param {Object} config the config object
    * @return {boolean} true if everything is perfect, false otherwise.
    */
	Chart.prototype._validate_config = function validate_chart(config){
		switch(arguments.callee.caller.name){
			case 'Chart':
				Chart.CHART_VALIDATOR.validate(config);
				break;
			case 'bar':
				Chart.BAR_VALIDATOR.validate(config);
				break;
			case 'line':
				Chart.LINE_VALIDATOR.validate(config);
				break;
		}
	}
	
	/**
    * [Private] Init the chart
    * @method _init
    */
	Chart.prototype._init = function _init(){
		var config 	= this.config,
			id 		= config.id + '_chart',
			$chart  = $('<div>'),
			$main 	= $('#' + config.id),
			i 		= 0,
			margins = config.margins;

		while(document.getElementById(id)){
			id = config.id + '_chart' + i++;
		}
		$chart
		.addClass('wak-chart')
		.attr('id' , id)
		.css({
			position 	: 'absolute',
			width		: '100%',
			left		: 0
		})
		.appendTo($main);

		this.chart 	= dc.compositeChart("#" + id, config.id);
		this.charts	= [];
		this.$chart	= $chart;
		
		// Set the zoom chart tag
		if(config.zoom.display){
			this.$zoom	= $('<div>');

			var zConf	= config.zoom,
				zMargins= zConf.margins = {};
			
			id 	= config.id + '_zoom';	
			i 	= 0;

			while(document.getElementById(id)){
				id 	  = config.id + '_zoom' + i++;
			}

			this
			.$zoom
			.addClass('wak-zoom')
			.attr({
				id : id
			})
			.css({
				height	: zConf.height,
				width	: '100%',
				position: 'absolute'
			})
			.appendTo($main);

			switch(zConf.position){
				case 'top':
					zMargins.top 	= margins.top;
					zMargins.bottom = 20;
					margins.top 	= 0;
					$chart.css('top' , zConf.height);
					this.$zoom.css('top' , 0);
					break;
				case 'bottom':
					zMargins.bottom	= margins.bottom;
					zMargins.top 	= 0;
					margins.bottom	= 20;
					$chart.css('bottom' , zConf.height);
					this.$zoom.css('bottom' , 0);
					break;
			}

			zMargins.left 	= margins.left;
			zMargins.right	= margins.right;

			$chart.height($main.height() - zConf.height);

			//Draw the zoom chart
			var that = this;
			this.zoom = dc[zConf.type]('#' + id, config.id)
			.width(this.$zoom.width())
	        .height(this.$zoom.height())
	        .margins(zMargins)

	        for(var attr in zConf.methods){
	        	if(typeof this.zoom[attr] == 'function'){
	        		this.zoom[attr](zConf.methods[attr]);
	        	}
	        }

	        for(var attr in zConf.events){
	        	this.zoom.on(attr , zConf.events[attr]);
	        }
		}
		else{
			$chart.height($main.height());
		}

		// init the graphic chart
		this
		.chart
		.width($chart.width())
        .height($chart.height())
        .margins(margins)

        for(var attr in config.methods){
        	if(typeof this.chart[attr] == 'function'){
        		this.chart[attr](config.methods[attr]);
        	}
        }

        for(var attr in config.events){
        	this.chart.on(attr , config.events[attr]);
        }
	}

	/**
    * Adds a bar chart to the current composit chart
    * @method bar
    * @param {Object} config the config object of the bar chart
    * @return {Objcet} bar chart object.
    */
	Chart.prototype.bar = function bar(config){
		/*this._validate_config(config);
		config = $.extend(
			true,
			{
				yAxis	: null,
				methods	: {

				}
			},
			config
		);*/

		throw "Not implemented!";

	}

	/**
    * Adds a line chart to the current composit chart
    * @method line
    * @param {Object} config the config object of the line chart
    * @return {Objcet} line chart object.
    */
	Chart.prototype.line = function line(config){
		this._validate_config(config);
		config = $.extend(
			true,
			{
				yAxis : null,
				'class': null,
				methods	: {
					renderArea	: true,
					elasticX	: true,
					title		: function (d) {
		                var value = d.value.total ? d.value.total : d.value;
		                if (isNaN(value)) value = 0;
		                return d3.time.format("%m/%d/%Y")(d.key) + "\n" + d3.format(".2f")(value);
		            }
				},
				events	: {
					
				}
			},
			config
		);

		var chart = dc
        .lineChart(this.chart, this.config.id)
        .group(this.config._meta.cGroup)
        .valueAccessor(function (d) {
    		return d[config.yAxis];
        })

        for(var attr in config.methods){
        	if(typeof chart[attr] == 'function'){
        		chart[attr](config.methods[attr]);
        	}
        }

        for(var attr in config.events){
        	chart.on(attr , config.events[attr]);
        }

        chart.config = config;

		this.charts.push(chart);
	}

	/**
    * Renders all the added charts to the current composit chart
    * @method draw
    * @return {Objcet} composite chart object.
    */
	Chart.prototype.draw = function draw(){
		this
		.chart
		.compose(this.charts)

		dc.renderAll(this.config.id);
	}

	/************************ Validator Class ************************/

	function Validator(config){
		this.config = config;
	}

	Validator.ERRORS = {
		UNKNOWN_TYPE 			: 'Unimplemented type (:1)',
		INVALID_ID 				: 'The given id ":1", does not much any element in the page',
		INVALID_ATTR			: 'The attribute ":1" is invalid',
		TYPE_MISMATCH			: 'The attribute ":1" does not have the right type (The allowed types : [:2])',
		MANDATORY 				: 'The attribute ":1" is mandatory',
		INVALID_ZOOM_POS		: 'The given position (":1") is invalid (valid positions : :2)',
		INVALID_ZOOM_CHART_TYPE	: 'The given chart type (":1") is invalid (valid types : :2)'
	}

	Validator.throwError = function(name){
		var res = Validator.ERRORS[name];
		for(var i = 1 , arg ; arg = arguments[i] ; i++){
			res = res.replace(new RegExp(':' + i , 'g') , arg);
		}
		throw new Error(res);
	}

	/**
    * Validate the given object
    * @method validate
    * @throws an error object if a parameter is not valid
    * @return {boolean} true if everything is perfect, false otherwise.
    */
	Validator.prototype.validate = function validate(obj){
		for(var attr in this.config){
			var field = this.config[attr];

			if(field instanceof Field){
				var value = parseAttr(obj , attr);

				if(field.mandatory
						&& (typeof value == 'undefined' || typeof value == 'null')){
					Validator.throwError('MANDATORY' , attr);
				}

				if(field.mandatory && field.allowedTypes
						&& !this.checkTypes(value , field.allowedTypes)){
					Validator.throwError('TYPE_MISMATCH' , attr , field.allowedTypes.toString())
				}

				if(typeof value != 'undefined' 
						&& typeof field.validate == 'function' 
						&& !field.validate.call(this , value) ){
					Validator.throwError('INVALID_ATTR' , attr);
				}
			}
		}
	}

	/**
    * Check the type of a given value
    * @method checkType
    * @param {Object} value the value to check
    * @param {Object} type the type that the value parameter must have
    * @return {boolean} true if everything is perfect, false otherwise.
    */
	Validator.prototype.checkTypes = function checkType(value , types){
		for(var i = 0 , type; type = types[i] ; i++){
			switch(type){
				case 'array':
					if(value instanceof Array){
						return true;
					}
					break;
				case 'datasource':
					if(value instanceof WAF.DataSourceEm){
						return true;
					}
					break;
				case 'string':
					if(Object.prototype.toString.call(value) == "[object String]"){
						return true;
					}
					break;
				case 'number':
					if(Object.prototype.toString.call(value) == "[object Number]"){
						return true;
					}
					break;
				default:
					Validator.throwError('UNKNOWN_TYPE' , type);
					return false;
			}
		}
		
		return false;
	}

	/************************ Field Class ************************/

	function Field(config){
		config = $.extend(true , {} , config);

		this.allowedTypes 	= config.allowedTypes;
		this.mandatory		= config.mandatory;
		this.validate 		= config.validate;
	}

	/************************ Utilities ************************/

	function parseAttr(obj , attr){
		if(typeof obj == 'undefined'){
			return obj;
		}

		var res = obj,
			arr = attr.split('.');

		for(var i = 0 , item ; item = arr[i] ; i++){
			res = res[item];
			if(typeof res == 'undefined'){
				return res;
			}
		}

		return res;
	}

	ns.Chart 		= Chart;
})(_ns);