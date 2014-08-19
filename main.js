(function() {
    var width = 1160,
        height = 600;

    var color = d3.scale.category20();

    var radius = d3.scale.sqrt().range([0, 6]);

    var selectionGlove = glow("selectionGlove").rgb("#0000A0").stdDeviation(7);
    var nodeSelected;
    var nodeClicked = function(dataPoint) {
        if (nodeSelected)
            nodeSelected.style("filter", "");

        nodeSelected = d3.select(this).select("circle").style("filter", "url(#selectionGlove)");
    };

    var linkSelected;
    var linkClicked = function(dataPoint) {
        Messenger().post({
            message: 'New Link Selected',
            type: 'info',
            hideAfter: 3,
            showCloseButton: true
        });

        if (linkSelected)
            linkSelected.style("filter", "");

        linkSelected = d3.select(this).select("line").style("filter", "url(#selectionGlove)");
    };

    var generateRandomID = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0,
                v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    var svg = d3.select("#topologyDisplay").append("svg")
        .attr("width", width)
        .attr("height", height)
        .call(selectionGlove);

    var getRandomInt = function(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    var refreshTopology = function(topology) {
        $('#topologyDisplay').empty();
        svg = d3.select("#topologyDisplay").append("svg")
            .attr("width", width)
            .attr("height", height)
            .call(selectionGlove);
        topology = $.extend(true, {}, topology);
        drawTopology(topology);

        Messenger().post({
            message: 'Refreshed',
            type: 'success',
            hideAfter: 1
        });
    };

    $.getJSON("ceph.json", function(json) {
        topology = json;
        refreshTopology(topology);
    });

    var drawTopology = function(graph) {
        var nodesList, linksList;
        nodesList = graph.nodes;
        linksList = graph.links;


        var force = d3.layout.force().nodes(nodesList).links(linksList)
            .size([width, height]).charge(-400)
            .linkStrength(function(d) {
                return d.bondType * 1;
            })
            .linkDistance(function(d) {
                return radius(d.source.weight*10) + radius(d.target.weight*10) + 20;
            })
            .on("tick", tick);

        var links = force.links(),
            nodes = force.nodes(),
            link = svg.selectAll(".link"),
            node = svg.selectAll(".node");

        buildTopology();

        function buildTopology() {
            // Update link data
            link = link.data(links, function(d) {
                return d.id;
            });

            // Create new links
            link.enter().insert("g", ".node")
                .attr("class", "link")
                .each(function(d) {
                    // Add bond line
                    d3.select(this)
                        .append("line")
                        .style("stroke-width", function(d) {
                            return (d.bondType * 3 - 2) * 2 + "px";
                        });
                    // If double add second line
                    d3.select(this)
                        .filter(function(d) {
                            return d.bondType >= 2;
                        }).append("line")
                        .style("stroke-width", function(d) {
                            return (d.bondType * 2 - 2) * 2 + "px";
                        })
                        .attr("class", "double");
                    d3.select(this)
                        .filter(function(d) {
                            return d.bondType === 3;
                        }).append("line")
                        .attr("class", "triple");

                    // Give bond the power to be selected
                    d3.select(this)
                        .on("click", linkClicked);
                });

            // Delete removed links
            link.exit().remove();

            // Update node data
            node = node.data(nodes, function(d) {
                return d.osd;
            });

            // Create new nodes
            node.enter().append("g")
                .attr("class", "node")
                .each(function(d) {
                    // Add node circle
                    d3.select(this)
                        .append("circle")
                        .attr("r", function(d) {
                            return radius(d.weight*10);
                        })
                        .style("fill", "#1f77b4");

                    // Add atom symbol
                    d3.select(this)
                        .append("text")
                        .attr("dy", ".35em")
                        .attr("text-anchor", "middle")
                        .text(function(d) {
                            return d.osd;
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
        }

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
