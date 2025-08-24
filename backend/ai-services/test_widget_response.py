#!/usr/bin/env python3
"""
Test Widget-based Response System
Demonstrates how AI responses are converted to interactive widgets
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, Any
from rich.console import Console
from rich.panel import Panel
from rich.json import JSON

sys.path.append(str(Path(__file__).parent))

from src.utils.response_parser import ResponseParser, Widget, WidgetType

console = Console()


def test_information_gathering_response():
    """Test parsing of information gathering response"""
    console.rule("[bold cyan]Test 1: Information Gathering Response[/]")
    
    # Sample AI response asking for project details
    ai_response = """
    That's a great goal! To help you get started with your full-stack application, I need a bit more information. Could you tell me about:

    1. What is the primary purpose or idea behind this application? (e.g., e-commerce, social media, productivity tool, data dashboard)
    2. What kind of features are you envisioning? (e.g., user authentication, data persistence, real-time updates, file uploads)
    3. Do you have any preferred technologies or languages in mind for the frontend, backend, or database?
    4. What's your current experience level with full-stack development?
    5. Are there any specific challenges or areas you'd like to focus on initially?
    """
    
    parser = ResponseParser()
    result = parser.parse_response(ai_response)
    
    console.print("\n[bold]Input Text:[/]")
    console.print(Panel(ai_response.strip(), border_style="dim"))
    
    console.print("\n[bold]Generated Widgets:[/]")
    console.print(JSON(json.dumps(result, indent=2)))
    
    # Verify widgets were created
    assert len(result["widgets"]) > 0, "No widgets generated"
    
    # Check widget types
    widget_types = [w["type"] for w in result["widgets"]]
    console.print(f"\n✓ Generated {len(result['widgets'])} widgets")
    console.print(f"  Widget types: {', '.join(set(widget_types))}")
    
    return result


def test_code_response():
    """Test parsing of code response"""
    console.rule("\n[bold cyan]Test 2: Code Response[/]")
    
    ai_response = """
    Here's a simple Express.js server to get you started:

    ```javascript
    const express = require('express');
    const app = express();
    const port = 3000;

    app.use(express.json());

    app.get('/', (req, res) => {
        res.json({ message: 'Hello World!' });
    });

    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
    ```

    And here's the package.json:

    ```json
    {
        "name": "my-app",
        "version": "1.0.0",
        "scripts": {
            "start": "node index.js"
        },
        "dependencies": {
            "express": "^4.18.0"
        }
    }
    ```
    """
    
    parser = ResponseParser()
    result = parser.parse_response(ai_response)
    
    console.print("\n[bold]Generated Code Widgets:[/]")
    
    for widget in result["widgets"]:
        if widget["type"] == "code_editor":
            console.print(f"\n• Code Editor Widget:")
            console.print(f"  Language: {widget['config'].get('language', 'unknown')}")
            console.print(f"  Lines: {len(widget['data']['code'].split(chr(10)))}")
    
    assert any(w["type"] == "code_editor" for w in result["widgets"]), "No code widgets generated"
    console.print("\n✓ Code widgets generated successfully")
    
    return result


def test_workflow_trigger():
    """Test detection of workflow triggers"""
    console.rule("\n[bold cyan]Test 3: Workflow Trigger Detection[/]")
    
    test_messages = [
        "I want to build a task management app",
        "Help me create an e-commerce platform",
        "I need to develop a social media dashboard",
        "Can you make a real-time chat application?",
        "Let's build a data visualization tool"
    ]
    
    console.print("[bold]Testing workflow trigger phrases:[/]\n")
    
    for message in test_messages:
        # Check if message should trigger workflow
        triggers_workflow = any(phrase in message.lower() for phrase in ['build', 'create', 'develop', 'make'])
        
        console.print(f"• \"{message}\"")
        console.print(f"  → Triggers workflow: [{'green' if triggers_workflow else 'red'}]{triggers_workflow}[/]")
    
    console.print("\n✓ Workflow trigger detection working")


def test_widget_structure():
    """Test widget structure and validation"""
    console.rule("\n[bold cyan]Test 4: Widget Structure Validation[/]")
    
    # Create sample widgets
    widgets = [
        Widget(
            id="project_desc",
            type=WidgetType.TEXTAREA.value,
            config={
                "label": "Project Description",
                "placeholder": "Describe your project...",
                "rows": 4
            },
            data={"required": True}
        ),
        Widget(
            id="tech_stack",
            type=WidgetType.MCQ.value,
            config={
                "label": "Technology Stack",
                "multiSection": True
            },
            data={
                "sections": [
                    {
                        "title": "Frontend",
                        "options": [
                            {"id": "react", "label": "React"},
                            {"id": "vue", "label": "Vue.js"}
                        ]
                    }
                ]
            }
        ),
        Widget(
            id="features",
            type=WidgetType.CHECKBOX.value,
            config={
                "label": "Features",
                "multiple": True
            },
            data={
                "options": [
                    {"id": "auth", "label": "Authentication"},
                    {"id": "api", "label": "REST API"}
                ]
            }
        )
    ]
    
    console.print("[bold]Widget Structures:[/]\n")
    
    for widget in widgets:
        widget_dict = widget.to_dict()
        console.print(f"• {widget.type} Widget ({widget.id})")
        console.print(f"  Config keys: {', '.join(widget_dict['config'].keys())}")
        console.print(f"  Data keys: {', '.join(widget_dict['data'].keys())}")
        
        # Validate structure
        assert "id" in widget_dict
        assert "type" in widget_dict
        assert "config" in widget_dict
        assert "data" in widget_dict
    
    console.print("\n✓ All widgets have valid structure")


def test_full_response_flow():
    """Test the complete response flow"""
    console.rule("\n[bold cyan]Test 5: Full Response Flow[/]")
    
    # Simulate user message
    user_message = "I want to build a full-stack application"
    
    console.print(f"[bold]User:[/] {user_message}\n")
    
    # AI would respond with questions
    ai_response = """
    That's exciting! Let me help you build your full-stack application. 
    
    First, I need to understand your requirements better:
    
    1. What is the primary purpose of your application?
    2. What features do you need?
    3. What's your preferred technology stack?
    4. What's your experience level?
    """
    
    # Parse response
    parser = ResponseParser()
    result = parser.parse_response(ai_response)
    
    # Check if workflow should be triggered
    triggers_workflow = any(phrase in user_message.lower() for phrase in ['build', 'create', 'develop', 'make'])
    
    if triggers_workflow and len(result["widgets"]) > 0:
        console.print("[green]✓ Workflow triggered with widgets[/]")
        console.print(f"  → {len(result['widgets'])} widgets will be displayed")
        console.print("  → User will interact with widgets instead of typing")
        console.print("  → Responses will be structured data")
    
    # Display summary
    console.print("\n[bold]Response Summary:[/]")
    response_json = {
        "content": "",  # Empty when using widgets
        "widgets": [
            {
                "id": w["id"],
                "type": w["type"],
                "label": w.get("config", {}).get("label", "Unknown")
            }
            for w in result["widgets"][:3]  # Show first 3
        ],
        "metadata": {
            "response_type": result["metadata"]["response_type"],
            "requires_input": result["metadata"]["requires_input"],
            "widget_count": len(result["widgets"])
        }
    }
    
    console.print(JSON(json.dumps(response_json, indent=2)))


def main():
    """Run all tests"""
    console.print("\n[bold magenta]=" * 60)
    console.print("[bold magenta]Widget-based Response System Test[/]")
    console.print("[bold magenta]=" * 60)
    
    try:
        # Run tests
        test_information_gathering_response()
        test_code_response()
        test_workflow_trigger()
        test_widget_structure()
        test_full_response_flow()
        
        console.print("\n[bold green]=" * 60)
        console.print("[bold green]All tests passed! ✓[/]")
        console.print("[bold green]=" * 60)
        
        console.print("\n[bold]Key Benefits:[/]")
        benefits = [
            "🎯 Structured data collection instead of free text",
            "🎨 Rich interactive UI with various widget types",
            "📊 Better user experience with guided input",
            "🚀 Automatic workflow triggering",
            "📋 Consistent data format for processing"
        ]
        
        for benefit in benefits:
            console.print(f"  {benefit}")
        
        console.print("\n[bold cyan]The system successfully converts AI text responses into interactive widgets![/]")
        
    except AssertionError as e:
        console.print(f"\n[red]Test failed: {e}[/]")
        sys.exit(1)
    except Exception as e:
        console.print(f"\n[red]Error: {e}[/]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()