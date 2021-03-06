    Ext.chart.series.Line.prototype.drawSeries= function() {
        var me = this,
            chart = me.chart,
            chartAxes = chart.axes,
            store = chart.getChartStore(),
            data = store.data.items,
            record,
            storeCount = store.getCount(),
            surface = me.chart.surface,
            bbox = {},
            group = me.group,
            showMarkers = me.showMarkers,
            markerGroup = me.markerGroup,
            enableShadows = chart.shadow,
            shadowGroups = me.shadowGroups,
            shadowAttributes = me.shadowAttributes,
            smooth = me.smooth,
            lnsh = shadowGroups.length,
            dummyPath = ["M"],
            path = ["M"],
            renderPath = ["M"],
            smoothPath = ["M"],
            markerIndex = chart.markerIndex,
            axes = [].concat(me.axis),
            shadowBarAttr,
            xValues = [],
            xValueMap = {},
            yValues = [],
            yValueMap = {},
            onbreak = false,
            storeIndices = [],
            markerStyle = Ext.apply({}, me.markerStyle),
            seriesStyle = me.seriesStyle,
            colorArrayStyle = me.colorArrayStyle,
            colorArrayLength = colorArrayStyle && colorArrayStyle.length || 0,
            isNumber = Ext.isNumber,
            seriesIdx = me.seriesIdx, 
            boundAxes = me.getAxesForXAndYFields(),
            boundXAxis = boundAxes.xAxis,
            boundYAxis = boundAxes.yAxis,
            xAxisType = boundXAxis ? chartAxes.get(boundXAxis).type : '',
            yAxisType = boundYAxis ? chartAxes.get(boundYAxis).type : '',
            shadows, shadow, shindex, fromPath, fill, fillPath, rendererAttributes,
            x, y, prevX, prevY, firstX, firstY, markerCount, i, j, ln, axis, ends, marker, markerAux, item, xValue,
            yValue, coords, xScale, yScale, minX, maxX, minY, maxY, line, animation, endMarkerStyle,
            endLineStyle, type, count, opacity, lineOpacity, fillOpacity, fillDefaultValue;

        if (me.fireEvent('beforedraw', me) === false) {
            return;
        }

        //if store is empty or the series is excluded in the legend then there's nothing to draw.
        if (!storeCount || me.seriesIsHidden) {
            me.hide();
            me.items = [];
            if (me.line) {
                me.line.hide(true);
                if (me.line.shadows) {
                    shadows = me.line.shadows;
                    for (j = 0, lnsh = shadows.length; j < lnsh; j++) {
                        shadow = shadows[j];
                        shadow.hide(true);
                    }
                }
                if (me.fillPath) {
                    me.fillPath.hide(true);
                }
            }
            me.line = null;
            me.fillPath = null;
            return;
        }

        //prepare style objects for line and markers
        endMarkerStyle = Ext.apply(markerStyle || {}, me.markerConfig, {
            fill: me.seriesStyle.fill || colorArrayStyle[me.themeIdx % colorArrayStyle.length]
        });
        type = endMarkerStyle.type;
        delete endMarkerStyle.type;
        endLineStyle = seriesStyle;
        //if no stroke with is specified force it to 0.5 because this is
        //about making *lines*
        if (!endLineStyle['stroke-width']) {
            endLineStyle['stroke-width'] = 0.5;
        }
        
        //set opacity values
        opacity = 'opacity' in endLineStyle ? endLineStyle.opacity : 1;
        fillDefaultValue = 'opacity' in endLineStyle ? endLineStyle.opacity : 0.3;
        lineOpacity = 'lineOpacity' in endLineStyle ? endLineStyle.lineOpacity : opacity;
        fillOpacity = 'fillOpacity' in endLineStyle ? endLineStyle.fillOpacity : fillDefaultValue;

        //If we're using a time axis and we need to translate the points,
        //then reuse the first markers as the last markers.
        if (markerIndex && markerGroup && markerGroup.getCount()) {
            for (i = 0; i < markerIndex; i++) {
                marker = markerGroup.getAt(i);
                markerGroup.remove(marker);
                markerGroup.add(marker);
                markerAux = markerGroup.getAt(markerGroup.getCount() - 2);
                marker.setAttributes({
                    x: 0,
                    y: 0,
                    translate: {
                        x: markerAux.attr.translation.x,
                        y: markerAux.attr.translation.y
                    }
                }, true);
            }
        }

        me.unHighlightItem();
        me.cleanHighlights();

        me.setBBox();
        bbox = me.bbox;
        me.clipRect = [bbox.x, bbox.y, bbox.width, bbox.height];

        if (axis = chartAxes.get(boundXAxis)) {
            ends = axis.applyData();
            minX = ends.from;
            maxX = ends.to;
        }

        if (axis = chartAxes.get(boundYAxis)) {
            ends = axis.applyData();
            minY = ends.from;
            maxY = ends.to;
        }

        // If a field was specified without a corresponding axis, create one to get bounds
        if (me.xField && !Ext.isNumber(minX)) {
            axis = me.getMinMaxXValues();
            minX = axis[0];
            maxX = axis[1];
        }

        if (me.yField && !Ext.isNumber(minY)) {
            axis = me.getMinMaxYValues();
            minY = axis[0];
            maxY = axis[1];
        }
        
        if (isNaN(minX)) {
            minX = 0;
            xScale = bbox.width / ((storeCount - 1) || 1);
        }
        else {
            xScale = bbox.width / ((maxX - minX) || (storeCount -1) || 1);
        }

        if (isNaN(minY)) {
            minY = 0;
            yScale = bbox.height / ((storeCount - 1) || 1);
        }
        else {
            yScale = bbox.height / ((maxY - minY) || (storeCount - 1) || 1);
        }
        // Extract all x and y values from the store
        for (i = 0, ln = data.length; i < ln; i++) {
            record = data[i];
            xValue = record.get(me.xField);
            if (xAxisType == 'Time' && typeof xValue == "string") {
                xValue = Date.parse(xValue);
            }
            // Ensure a value
            if (typeof xValue == 'string' || typeof xValue == 'object' && !Ext.isDate(xValue)
                //set as uniform distribution if the axis is a category axis.
                || boundXAxis && chartAxes.get(boundXAxis) && chartAxes.get(boundXAxis).type == 'Category') {
                    if (xValue in xValueMap) {
                        xValue = xValueMap[xValue];
                    } else {
                        xValue = xValueMap[xValue] = i;
                    }
            }

            // Filter out values that don't fit within the pan/zoom buffer area
            yValue = record.get(me.yField);
            if (yAxisType == 'Time' && typeof yValue == "string") {
                yValue = Date.parse(yValue);
            }
            //skip undefined values
            if (typeof yValue == 'undefined' || (typeof yValue == 'string' && !yValue)) {
                //<debug warn>
                if (Ext.isDefined(Ext.global.console)) {
                    Ext.global.console.warn("[Ext.chart.series.Line]  Skipping a store element with an undefined value at ", record, xValue, yValue);
                }
                //</debug>
                continue;
            }
            // Ensure a value
            if (typeof yValue == 'string' || typeof yValue == 'object' && !Ext.isDate(yValue)
                //set as uniform distribution if the axis is a category axis.
                || boundYAxis && chartAxes.get(boundYAxis) && chartAxes.get(boundYAxis).type == 'Category') {
                yValue = i;
            }
            storeIndices.push(i);
            xValues.push(xValue);
            yValues.push(yValue);
        }

        ln = xValues.length;
        if (ln > bbox.width) {
            coords = me.shrink(xValues, yValues, bbox.width);
            xValues = coords.x;
            yValues = coords.y;
        }

        me.items = [];
		
		//SFR
		chart.scaleX = function(xValue){
			return (bbox.x + (xValue - minX) * xScale).toFixed(2);
		}
		chart.scaleY = function(yValue){
			return ((bbox.y + bbox.height) - (yValue - minY) * yScale).toFixed(2);
		}
		chart.revX = function(x){
			return (x-bbox.x)/xScale +  minX;
		}
		chart.revY = function(y){
			return  -(y-(bbox.y + bbox.height))/yScale + minY;
		}
		// END SFR

        count = 0;
        ln = xValues.length;
        for (i = 0; i < ln; i++) {
            xValue = xValues[i];
            yValue = yValues[i];
            if (yValue === false) {
                if (path.length == 1) {
                    path = [];
                }
                onbreak = true;
                me.items.push(false);
                continue;
            } else {
                x = (bbox.x + (xValue - minX) * xScale).toFixed(2);
                y = ((bbox.y + bbox.height) - (yValue - minY) * yScale).toFixed(2);
                if (onbreak) {
                    onbreak = false;
                    path.push('M');
                }
                path = path.concat([x, y]);
            }
            if ((typeof firstY == 'undefined') && (typeof y != 'undefined')) {
                firstY = y;
                firstX = x;
            }
            // If this is the first line, create a dummypath to animate in from.
            if (!me.line || chart.resizing) {
                dummyPath = dummyPath.concat([x, bbox.y + bbox.height / 2]);
            }

            // When resizing, reset before animating
            if (chart.animate && chart.resizing && me.line) {
                me.line.setAttributes({
                    path: dummyPath,
                    opacity: lineOpacity
                }, true);
                if (me.fillPath) {
                    me.fillPath.setAttributes({
                        path: dummyPath,
                        opacity: fillOpacity
                    }, true);
                }
                if (me.line.shadows) {
                    shadows = me.line.shadows;
                    for (j = 0, lnsh = shadows.length; j < lnsh; j++) {
                        shadow = shadows[j];
                        shadow.setAttributes({
                            path: dummyPath
                        }, true);
                    }
                }
            }
            if (showMarkers) {
                marker = markerGroup.getAt(count++);
                if (!marker) {
                    marker = Ext.chart.Shape[type](surface, Ext.apply({
                        group: [group, markerGroup],
                        x: 0, y: 0,
                        translate: {
                            x: +(prevX || x),
                            y: prevY || (bbox.y + bbox.height / 2)
                        },
                        value: '"' + xValue + ', ' + yValue + '"',
                        zIndex: 4000
                    }, endMarkerStyle));
                    marker._to = {
                        translate: {
                            x: +x,
                            y: +y
                        }
                    };
                } else {
                    marker.setAttributes({
                        value: '"' + xValue + ', ' + yValue + '"',
                        x: 0, y: 0,
                        hidden: false
                    }, true);
                    marker._to = {
                        translate: {
                            x: +x, 
                            y: +y
                        }
                    };
                }
            }
            me.items.push({
                series: me,
                value: [xValue, yValue],
                point: [x, y],
                sprite: marker,
                storeItem: store.getAt(storeIndices[i])
            });
            prevX = x;
            prevY = y;
        }

        if (path.length <= 1) {
            //nothing to be rendered
            return;
        }

        if (me.smooth) {
            smoothPath = Ext.draw.Draw.smooth(path, isNumber(smooth) ? smooth : me.defaultSmoothness);
        }

        renderPath = smooth ? smoothPath : path;

        //Correct path if we're animating timeAxis intervals
        if (chart.markerIndex && me.previousPath) {
            fromPath = me.previousPath;
            if (!smooth) {
                Ext.Array.erase(fromPath, 1, 2);
            }
        } else {
            fromPath = path;
        }

        // Only create a line if one doesn't exist.
        if (!me.line) {
            me.line = surface.add(Ext.apply({
                type: 'path',
                group: group,
                path: dummyPath,
                stroke: endLineStyle.stroke || endLineStyle.fill
            }, endLineStyle || {}));

            //set configuration opacity
            me.line.setAttributes({
                opacity: lineOpacity
            }, true);

            if (enableShadows) {
                me.line.setAttributes(Ext.apply({}, me.shadowOptions), true);
            }

            //unset fill here (there's always a default fill withing the themes).
            me.line.setAttributes({
                fill: 'none',
                zIndex: 3000
            });
            if (!endLineStyle.stroke && colorArrayLength) {
                me.line.setAttributes({
                    stroke: colorArrayStyle[me.themeIdx % colorArrayLength]
                }, true);
            }
            if (enableShadows) {
                //create shadows
                shadows = me.line.shadows = [];
                for (shindex = 0; shindex < lnsh; shindex++) {
                    shadowBarAttr = shadowAttributes[shindex];
                    shadowBarAttr = Ext.apply({}, shadowBarAttr, { path: dummyPath });
                    shadow = surface.add(Ext.apply({}, {
                        type: 'path',
                        group: shadowGroups[shindex]
                    }, shadowBarAttr));
                    shadows.push(shadow);
                }
            }
        }
        if (me.fill) {
            fillPath = renderPath.concat([
                ["L", x, bbox.y + bbox.height],
                ["L", firstX, bbox.y + bbox.height],
                ["L", firstX, firstY]
            ]);
            if (!me.fillPath) {
                me.fillPath = surface.add({
                    group: group,
                    type: 'path',
                    fill: endLineStyle.fill || colorArrayStyle[me.themeIdx % colorArrayLength],
                    path: dummyPath
                });
            }
        }
        markerCount = showMarkers && markerGroup.getCount();
        if (chart.animate) {
            fill = me.fill;
            line = me.line;
            //Add renderer to line. There is not unique record associated with this.
            rendererAttributes = me.renderer(line, false, { path: renderPath }, i, store);
            Ext.apply(rendererAttributes, endLineStyle || {}, {
                stroke: endLineStyle.stroke || endLineStyle.fill
            });
            //fill should not be used here but when drawing the special fill path object
            delete rendererAttributes.fill;
            line.show(true);
            if (chart.markerIndex && me.previousPath) {
                me.animation = animation = me.onAnimate(line, {
                    to: rendererAttributes,
                    from: {
                        path: fromPath
                    }
                });
            } else {
                me.animation = animation = me.onAnimate(line, {
                    to: rendererAttributes
                });
            }
            //animate shadows
            if (enableShadows) {
                shadows = line.shadows;
                for(j = 0; j < lnsh; j++) {
                    shadows[j].show(true);
                    if (chart.markerIndex && me.previousPath) {
                        me.onAnimate(shadows[j], {
                            to: { path: renderPath },
                            from: { path: fromPath }
                        });
                    } else {
                        me.onAnimate(shadows[j], {
                            to: { path: renderPath }
                        });
                    }
                }
            }
            //animate fill path
            if (fill) {
                me.fillPath.show(true);
                me.onAnimate(me.fillPath, {
                    to: Ext.apply({}, {
                        path: fillPath,
                        fill: endLineStyle.fill || colorArrayStyle[me.themeIdx % colorArrayLength],
                        'stroke-width': 0,
                        opacity: fillOpacity
                    }, endLineStyle || {})
                });
            }
            //animate markers
            if (showMarkers) {
                count = 0;
                for(i = 0; i < ln; i++) {
                    if (me.items[i]) {
                        item = markerGroup.getAt(count++);
                        if (item) {
                            rendererAttributes = me.renderer(item, store.getAt(i), item._to, i, store);
                            me.onAnimate(item, {
                                to: Ext.applyIf(rendererAttributes, endMarkerStyle || {})
                            });
                            item.show(true);
                        }
                    }
                }
                for(; count < markerCount; count++) {
                    item = markerGroup.getAt(count);
                    item.hide(true);
                }
//                for(i = 0; i < (chart.markerIndex || 0)-1; i++) {
//                    item = markerGroup.getAt(i);
//                    item.hide(true);
//                }
            }
        } else {
            rendererAttributes = me.renderer(me.line, false, { path: renderPath, hidden: false }, i, store);
            Ext.apply(rendererAttributes, endLineStyle || {}, {
                stroke: endLineStyle.stroke || endLineStyle.fill
            });
            //fill should not be used here but when drawing the special fill path object
            delete rendererAttributes.fill;
            me.line.setAttributes(rendererAttributes, true);
            me.line.setAttributes({
                opacity: lineOpacity
            }, true);
            //set path for shadows
            if (enableShadows) {
                shadows = me.line.shadows;
                for(j = 0; j < lnsh; j++) {
                    shadows[j].setAttributes({
                        path: renderPath,
                        hidden: false
                    }, true);
                }
            }
            if (me.fill) {
                me.fillPath.setAttributes({
                    path: fillPath,
                    hidden: false,
                    opacity: fillOpacity
                }, true);
            }
            if (showMarkers) {
                count = 0;
                for(i = 0; i < ln; i++) {
                    if (me.items[i]) {
                        item = markerGroup.getAt(count++);
                        if (item) {
                            rendererAttributes = me.renderer(item, store.getAt(i), item._to, i, store);
                            item.setAttributes(Ext.apply(endMarkerStyle || {}, rendererAttributes || {}), true);
                            if (!item.attr.hidden) {
                                item.show(true);
                            }
                        }
                    }
                }
                for(; count < markerCount; count++) {
                    item = markerGroup.getAt(count);
                    item.hide(true);
                }
            }
        }

        if (chart.markerIndex) {
            if (me.smooth) {
                Ext.Array.erase(path, 1, 2);
            } else {
                Ext.Array.splice(path, 1, 0, path[1], path[2]);
            }
            me.previousPath = path;
        }
        me.renderLabels();
        me.renderCallouts();

        me.fireEvent('draw', me);
    }
	
	Ext.chart.Chart.prototype.redraw = function(resize) {
        var me = this,
            seriesItems = me.series.items,
            seriesLen = seriesItems.length,
            axesItems = me.axes.items,
            axesLen = axesItems.length,
            themeIndex = 0,
            i, item,
            chartBBox = me.chartBBox = {
                x: 0,
                y: 0,
                height: me.curHeight,
                width: me.curWidth
            },
            legend = me.legend, 
            series;
            
        me.surface.setSize(chartBBox.width, chartBBox.height);
        // Instantiate Series and Axes
        for (i = 0; i < seriesLen; i++) {
            item = seriesItems[i];
            if (!item.initialized) {
                series = me.initializeSeries(item, i, themeIndex);
            } else {
                series = item;
            }
            // Allow the series to react to a redraw, for example, a pie series
            // backed by a remote data set needs to build legend labels correctly
            series.onRedraw();
            // For things like stacked bar charts, a single series can consume
            // multiple colors from the index, so we compensate for it here
            if (Ext.isArray(item.yField)) {
                themeIndex += item.yField.length;
            } else {
                ++themeIndex;
            }
        }
        for (i = 0; i < axesLen; i++) {
            item = axesItems[i];
            if (!item.initialized) {
                me.initializeAxis(item);
            }
        }
        //process all views (aggregated data etc) on stores
        //before rendering.
        for (i = 0; i < axesLen; i++) {
            axesItems[i].processView();
        }
        for (i = 0; i < axesLen; i++) {
            axesItems[i].drawAxis(true);
        }

        // Create legend if not already created
        if (legend !== false && legend.visible) {
            if (legend.update || !legend.created) {
                legend.create();
            }
        }

        // Place axes properly, including influence from each other
        me.alignAxes();

        // Reposition legend based on new axis alignment
        if (legend !== false && legend.visible) {
            legend.updatePosition();
        }

        // Find the max gutters
        me.getMaxGutters();

        // Draw axes and series
        me.resizing = !!resize;

        for (i = 0; i < axesLen; i++) {
            axesItems[i].drawAxis();
        }
        for (i = 0; i < seriesLen; i++) {
            me.drawCharts(seriesItems[i]);
        }
		
		//SFR
		//console.log("update!");
		if(this.oldLinks){
			for(var i=0; i<this.oldLinks.length; i++){
				this.oldLinks[i].remove();
			}
			this.oldLinks = []; 
		}
		if(this.links){
			this.oldLinks = []
			for(var link in this.links){
				drawLink(this, this.links[link][0], this.links[link][1])
			}
		}
		//SFR
		
        me.resizing = false;
    }
	
	function drawLink(chart, start, end){
		//console.log(start);
		//console.log(start.items[0]);
		var path = [[chart.scaleX(start.items[0]), chart.scaleY(start.items[1])], [chart.scaleX(end.items[0]), chart.scaleY(end.items[1])]];//[chart.scaleX(start.items[0]), chart.scaleY(start.items[1]), chart.scaleX(end.items[0]), chart.scaleY(end.items[1])];
	drawPath(chart, path, "#aaaaaa", 0.5, "#aaaaaa",1)
	//console.log(path);
	/*	var line = chart.surface.add({
		                type: 'path',
		                path: path,
						zIndex: 3000,
		                hidden: false,
						opacity: .5
		            });
					
					line.show(true);
				
					console.log("----")*/
	
	}
	
	function drawPath(canvas,points,color,opacity,stroke,strokeWidth, listeners) {
	    // given an array of [x,y] coords relative to canvas axis, draws a path.
	    // only supports straight lines
	    if (typeof listeners == 'undefined' || listeners == "") {
	        listeners = null;
	    }
	    if (stroke == '' || strokeWidth == '' || typeof stroke == 'undefined' || typeof strokeWidth == 'undefined') {
	        stroke = null;
	        strokeWidth = null;
	    }
	    var path = path+"M"+points[0][0]+" "+points[0][1]+" "; // start svg path parameters with given array
	    for (i=1;i<points.length;i++) {
	        path = path+"L"+points[i][0]+" "+points[i][1]+" ";
	    }
	    path = path + "Z"; // end svg path params
	    var sprite = canvas.surface.add({
	        type: 'path',
	        opacity: opacity,
	        fill:color,
	        path: path,
	        stroke:stroke,
	        'stroke-width': strokeWidth,
	        listeners: listeners
	    }).show(true);
	    this.currFill = sprite;
		
		canvas.oldLinks.push(sprite);
	}
	

	var unfilteredRange = function () {
        var me = this,
            chart = me.chart,
            store = chart.getChartStore(),
            data = store.queryBy(function(x) {
				return true;
			}).items,
            series = chart.series.items,
            position = me.position,
            axes,
            seriesClasses = Ext.chart.series,
            aggregations = [],
            min = Infinity, max = -Infinity,
            vertical = me.position === 'left' || me.position === 'right' || me.position === 'radial',
            i, ln, ln2, j, k, dataLength = data.length, aggregates,
            countedFields = {},
            allFields = {},
            excludable = true,
            fields, fieldMap, record, field, value;

        fields = me.fields;
        for (j = 0, ln = fields.length; j < ln; j++) {
            allFields[fields[j]] = true;
        }

        for (i = 0, ln = series.length; i < ln; i++) {
            if (series[i].seriesIsHidden) {
                continue;
            }
            if (!series[i].getAxesForXAndYFields) {
                continue;
            }
            axes = series[i].getAxesForXAndYFields();
            if (axes.xAxis && axes.xAxis !== position && axes.yAxis && axes.yAxis !== position) {
                // The series doesn't use this axis.
                continue;
            }

            if (seriesClasses.Bar && series[i] instanceof seriesClasses.Bar && !series[i].column) {
                // If this is a horizontal bar series, then flip xField and yField.
                fields = vertical ? Ext.Array.from(series[i].xField) : Ext.Array.from(series[i].yField);
            } else {
                fields = vertical ? Ext.Array.from(series[i].yField) : Ext.Array.from(series[i].xField);
            }

            if (me.fields.length) {
                for (j = 0, ln2 = fields.length; j < ln2; j++) {
                    if (allFields[fields[j]]) {
                        break;
                    }
                }
                if (j == ln2) {
                    // Not matching fields, skipping this series.
                    continue;
                }
            }

            if (aggregates = series[i].stacked) {
                // If this is a bar/column series, then it will be aggregated if it is of the same direction of the axis.
                if (seriesClasses.Bar && series[i] instanceof seriesClasses.Bar) {
                    if (series[i].column != vertical) {
                        aggregates = false;
                        excludable = false;
                    }
                }
                // Otherwise it is stacked vertically
                else if (!vertical) {
                    aggregates = false;
                    excludable = false;
                }
            }


            if (aggregates) {
                fieldMap = {};
                for (j = 0; j < fields.length; j++) {
                    if (excludable && series[i].__excludes && series[i].__excludes[j]) {
                        continue;
                    }
                    if (!allFields[fields[j]]) {
                        Ext.Logger.warn('Field `' + fields[j] + '` is not included in the ' + position + ' axis config.');
                    }
                    allFields[fields[j]] = fieldMap[fields[j]] = true;
                }
                aggregations.push({
                    fields: fieldMap,
                    positiveValue: 0,
                    negativeValue: 0
                });
            } else {

                if (!fields || fields.length == 0) {
                    fields = me.fields;
                }
                for (j = 0; j < fields.length; j++) {
                    if (excludable && series[i].__excludes && series[i].__excludes[j]) {
                        continue;
                    }
                    allFields[fields[j]] = countedFields[fields[j]] = true;
                }
            }
        }

        for (i = 0; i < dataLength; i++) {
            record = data[i];
            for (k = 0; k < aggregations.length; k++) {
                aggregations[k].positiveValue = 0;
                aggregations[k].negativeValue = 0;
            }
            for (field in allFields) {
                value = record.get(field);
                if (me.type == 'Time' && typeof value == "string") {
                    value = Date.parse(value);
                }
                if (isNaN(value)) {
                    continue;
                }
                if (value === undefined) {
                    value = 0;
                } else {
                    value = Number(value);
                }
                if (countedFields[field]) {
                    if (min > value) {
                        min = value;
                    }
                    if (max < value) {
                        max = value;
                    }
                }
                for (k = 0; k < aggregations.length; k++) {
                    if (aggregations[k].fields[field]) {

                        if (value >= 0) {
                            aggregations[k].positiveValue += value;
                            if (max < aggregations[k].positiveValue) {
                                max = aggregations[k].positiveValue;
                            }
                            // If any aggregation is actually hit, then the min value should be at most 0.
                            if (min > 0) {
                                min = 0;
                            }
                        } else {
                            aggregations[k].negativeValue += value;
                            if (min > aggregations[k].negativeValue) {
                                min = aggregations[k].negativeValue;
                            }
                            // If any aggregation is actually hit, then the max value should be at least 0.
                            if (max < 0) {
                                max = 0;
                            }
                        }
                    }
                }
            }
        }

        if (!isFinite(max)) {
            max = me.prevMax || 0;
        }
        if (!isFinite(min)) {
            min = me.prevMin || 0;
        }

        if (typeof min === 'number') {
            min = Ext.Number.correctFloat(min);
        }
         
        if (typeof max === 'number') {
            max = Ext.Number.correctFloat(max);
        }
        
        //normalize min max for snapEnds.
        if (min != max && (max != Math.floor(max) || min != Math.floor(min))) {
            min = Math.floor(min);
            max = Math.floor(max) + 1;
        }

        if (!isNaN(me.minimum)) {
            min = me.minimum;
        }

        if (!isNaN(me.maximum)) {
            max = me.maximum;
        }

        if (min >= max) {
            // snapEnds will return NaN if max >= min;
            min = Math.floor(min);
            max = min + 1;                
        }

        return {min: min, max: max};
    }