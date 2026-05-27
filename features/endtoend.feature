Feature: Employee Management
  As an HR Admin
  I want to create and delete employees
  So that I can manage the employee records in the system

  Background:
    Given I am on the OrangeHRM login page

  Scenario: Create and Delete an Employee
    When I login with username "testadmin" and password "Vibetestq@123#"
    Then the Dashboard page should be displayed

    When I navigate to the PIM module
    And I click the "Add" button
    And I fill in the first name as "Test" and last name as "Employee"
    And I note the auto-generated Employee ID
    And I click the "Save" button
    Then the Personal Details page should be displayed

    When I navigate to the Employee List
    And I search for the employee by the noted Employee ID
    And I select the employee from the search results
    And I click "Delete Selected"
    And I confirm the deletion by clicking "Yes, Delete"
    Then the employee list should show "No Records Found" for the same Employee ID