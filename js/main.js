/* vim: set tabstop=4 shiftwidth=4 expandtab : */
// https://github.com/mbostock/d3/wiki/Force-Layout
(function() {

    // global chart values
    var width = 1160,
        height = 600;
    
    // scale for circle radius
    var radius = d3.scale.sqrt().range([0, 6]);
    var strength = d3.scale.sqrt().range([0, 1]);

    // glow on selection 
    var selectionGlove = glow("selectionGlove").rgb("#0000A0").stdDeviation(7);
    var nodeSelected;
    var nodeClicked = function(dataPoint) {
        if (nodeSelected)
            nodeSelected.style("filter", "");

        nodeSelected = d3.select(this).select("circle").style("filter", "url(#selectionGlove)");
    };

    // distinct link on selection
    var linkSelected;
    var linkClicked = function(dataPoint) {
        Messenger().post({
            message: 'Link Selected',
            type: 'info',
            hideAfter: 3,
            showCloseButton: true
        });

        if (linkSelected)
            linkSelected.style("filter", "");

        linkSelected = d3.select(this).select("line").style("filter", "url(#selectionGlove)");
    };

    // append svg area to div
    var svg = d3.select("#topologyDisplay").append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(selectionGlove);

    // deal with topology output from rest call
    // ( required for some preprocessing )
    // also resets the svg area on new topology data arrival
    var refreshTopology = function(topology) {
        // cleanup the existing topology
        $('#topologyDisplay').empty();
        svg = d3.select("#topologyDisplay").append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(selectionGlove);
        topology = $.extend(true, {}, topology);
        
        // update link references (otherwise the indexes are used, and breaks)
        var nodeHash = {};
        topology.nodes.forEach(function(d) {
            // make sure weight is defined for all nodes
            if (!d.crush_weight)
                d.crush_weight = 1;
            nodeHash[d.id] = d;
            // add the links if existing
            if (d.children) {
                for (var i=0; i<d.children.length; i++) {
                    topology.links.push(
                        { "source": d.id, "target": d.children[i], "type": d.type_id });
                }
            }
        });
        topology.links.forEach(function(d) {
            d.source = nodeHash[d.source];
            d.target = nodeHash[d.target];
        });
        drawTopology(topology);

        Messenger().post({
            message: 'Refreshed',
            type: 'success',
            hideAfter: 1
        });
    };

    // get new topology data
    $.getJSON("data/tree.json", function(json) {
        topology = { "nodes": json.nodes, "links": [] }
        refreshTopology(topology);
    });

    // called by refreshTopology to redraw
    var drawTopology = function(graph) {

        var max_nodetype = d3.max(topology.nodes, function(d) { return d.type_id; });

        var force = d3.layout.force().nodes(graph.nodes).links(graph.links)
            .size([width, height]).charge(-500)
            .linkStrength(function(d) {
                return max_nodetype - d.type;
            })
            .linkDistance(function(d) {
                return radius(d.source.crush_weight*10) + radius(d.target.crush_weight*10) + 10;
            })
            .on("tick", tick);

        var links = force.links(),
            nodes = force.nodes();

        // Update link data
        var link = svg.selectAll(".link").data(links);

        // Create new links
        link.enter().insert("g", ".node")
            .attr("class", "link")
            .each(function(d) {
                // Add bond line
                d3.select(this)
                    .append("line")
                    .style("stroke-width", function(d) {
                        return d.type == max_nodetype ? 0 : 1;
                    });

                // Give bond the power to be selected
                d3.select(this)
                    .on("click", linkClicked);
            });

        // Delete removed links
        link.exit().remove();

        // Update node data
        var node = svg.selectAll(".node").data(nodes);

        // Create new nodes
        node.enter().append("g")
            .attr("class", "node")
            .each(function(d) {
                // Add node circle
                d3.select(this)
                    .append("circle")
                    .attr("r", function(d) {
                        return d.type_id != max_nodetype ? radius((d.type_id+1) * d.crush_weight * 10) : radius(0);
                    })
                    .style("fill", function(d) {
                        if (d.type == 'osd')
                           return d.status == 'up' ? "#009966" : "#CC3333";
                        return "#339999";
                    });

                // Add atom symbol
                d3.select(this)
                    .append("text")
                    .attr("dy", ".35em")
                    .attr("text-anchor", "middle")
                    .text(function(d) {
                        if (d.type_id != max_nodetype)
                            return d.name;
                    });

                // Give atom the power to be selected
                d3.select(this)
                    .on("click", nodeClicked);

                // Grant atom the power of gravity	
                d3.select(this)
                    .call(force.drag);
            });

        // Delete removed nodes
        node.exit().remove();

        force.start();

        function tick() {
            //Update old and new elements
            link.selectAll("line")
                .attr("x1", function(d) {
                    return d.source.x;
                })
                .attr("y1", function(d) {
                    return d.source.y;
                })
                .attr("x2", function(d) {
                    return d.target.x;
                })
                .attr("y2", function(d) {
                    return d.target.y;
                });

            node.attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            });
        }
    };
})();
