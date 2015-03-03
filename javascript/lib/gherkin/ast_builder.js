var AstNode = require('./ast_node');

module.exports = function AstBuilder () {

  var stack = [new AstNode('None')];

  this.startRule = function (ruleType) {
    stack.push(new AstNode(ruleType));
  };

  this.endRule = function (ruleType) {
    var node = stack.pop();
    var transformedNode = transformNode(node);
    currentNode().add(node.ruleType, transformedNode);
  };

  this.build = function (token) {
    currentNode().add(token.matchedType, token);
  };

  this.getResult = function () {
    return currentNode().getSingle('Feature');
  };

  function currentNode () {
    return stack[stack.length - 1];
  }

  function getLocation (token, column) {
    return !column ? token.location : {line: token.location.line, column: column};
  }

  function getTags (node) {
    var tagsNode = node.getSingle('Tags');
    if (!tagsNode) return [];
    console.log('TAGSNODE', tagsNode)
    // return tagsNode.getTokens('TagLine').map(function (token) {
    //   return {
    //     location: getLocation(token)
    //   }
    // });
  }

  function getCells(tableRowToken) {
    return tableRowToken.matchedItems.map(function (cellItem) {
      return {
        location: getLocation(tableRowToken, cellItem.column),
        value: cellItem.text
      }
    });
  }

  function getDescription (node) {
    return node.getSingle('Description');
  }

  function getSteps (node) {
    return node.getItems('Step');
  }

  function getTableRows(node) {
    var rows = node.getTokens('TableRow').map(function (token) {
      return {
        location: getLocation(token),
        cells: getCells(token)
      };
    });
    //EnsureCellCount(rows);
    return rows;
  }

  function transformNode(node) {
    switch(node.ruleType) {
      case 'Step':
        var stepLine = node.getToken('StepLine');
        var stepArgument = node.getSingle('DataTable') || node.getSingle('DocString') || null;

        return {
          type: node.ruleType,
          location: getLocation(stepLine),
          keyword: stepLine.matchedKeyword,
          name: stepLine.matchedText,
          argument: stepArgument
        }
      case 'DocString':
        var separatorToken = node.getTokens('DocStringSeparator')[0];
        var contentType = separatorToken.matchedText;
        var lineTokens = node.getTokens('Other');
        var content = lineTokens.map(function (t) {return t.matchedText}).join("\n");

        return {
          type: node.ruleType,
          location: getLocation(separatorToken),
          contentType: contentType,
          content: content
        };
      case 'Scenario_Definition':
        var tags = getTags(node);
        var scenarioNode = node.getSingle('Scenario');
        if(scenarioNode) {
          var scenarioLine = scenarioNode.getToken('ScenarioLine');
          var description = getDescription(scenarioNode);
          var steps = getSteps(scenarioNode);

          return {
            type: node.ruleType,
            tags: tags,
            location: getLocation(scenarioLine),
            keyword: scenarioLine.matchedKeyword,
            name: scenarioLine.matchedText,
            description: description,
            steps: steps
          };
        } else {
          var scenarioOutlineNode = node.getSingle('ScenarioOutline');
          if(!scenarioOutlineNode) throw new Error('Internal grammar error');

          var scenarioOutlineLine = scenarioOutlineNode.getToken('ScenarioOutlineLine');
          var description = getDescription(scenarioOutlineNode);
          var steps = getSteps(scenarioOutlineNode);
          var examples = scenarioOutlineNode.getItems('Examples');

          return {
            type: node.ruleType,
            tags: tags,
            location: getLocation(scenarioOutlineLine),
            keyword: scenarioOutlineLine.matchedKeyword,
            name: scenarioOutlineLine.matchedText,
            description: description,
            steps: steps,
            examples: examples
          };
        }
      case 'Examples':
        var tags = getTags(node);
        var examplesLine = node.getToken('ExamplesLine');
        var description = getDescription(node);

        var allRows = getTableRows(node);
        var header = allRows[0];
        var rows = allRows.slice(1);

        return {
          type: node.ruleType,
          tags: tags,
          location: getLocation(examplesLine),
          keyword: examplesLine.matchedKeyword,
          name: examplesLine.matchedText,
          description: description,
          header: header,
          rows: rows
        };

      case 'Feature':
        var header = node.getSingle('Feature_Header');
        var tags = getTags(header);
        var featureLine = header.getToken('FeatureLine');
        var background = node.getSingle('Background');
        var scenariodefinitions = node.getItems('Scenario_Definition');
        var description = getDescription(header);
        var language = featureLine.matchedGherkinDialect;

        return {
          type: node.ruleType,
          tags: tags,
          location: getLocation(featureLine),
          language: language,
          keyword: featureLine.matchedKeyword,
          name: featureLine.matchedText,
          description: description,
          background: background,
          scenarioDefinitions: scenariodefinitions
        };
      default:
        return node;
    }
  }

};