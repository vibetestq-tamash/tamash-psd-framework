Feature: OrangeHRM Login
  As an OrangeHRM user
  I want to log in to the application
  So that I can access HR management features

  Background:
    Given I navigate to the OrangeHRM login page "https://vibetestq-osondemand.orangehrm.com/"

  @smoke @login
  Scenario: Successful login with valid credentials
    When I enter username "testadmin"
    And I enter password "Admin@123#"
    And I click the Login button
    Then I should be redirected to the Dashboard
    And I should see the navigation menu

  @login
  Scenario: Login fails with invalid password
    When I enter username "testadmin"
    And I enter password "wrongpassword"
    And I click the Login button
    Then I should see the error message "Invalid credentials"
    And I should remain on the login page

  @login
  Scenario: Login fails with invalid username
    When I enter username "invaliduser"
    And I enter password "Admin@123#"
    And I click the Login button
    Then I should see the error message "Invalid credentials"
    And I should remain on the login page

  @login
  Scenario: Login fails with empty credentials
    When I leave the username field empty
    And I leave the password field empty
    And I click the Login button
    Then I should see the required field error for username
    And I should see the required field error for password

  @login
  Scenario: Login fails with empty username
    When I leave the username field empty
    And I enter password "Admin@123#"
    And I click the Login button
    Then I should see the required field error for username

  @login
  Scenario: Login fails with empty password
    When I enter username "testadmin"
    And I leave the password field empty
    And I click the Login button
    Then I should see the required field error for password

  @login
  Scenario: Password field masks the input
    When I enter password "Admin@123#"
    Then the password field should display masked characters

  @login
  Scenario: Successful logout after login
    When I enter username "testadmin"
    And I enter password "Admin@123#"
    And I click the Login button
    Then I should be redirected to the Dashboard
    When I click on the user profile menu
    And I click the Logout option
    Then I should be redirected to the login page

  @login
  Scenario Outline: Login with multiple user credentials
    When I enter username "<username>"
    And I enter password "<password>"
    And I click the Login button
    Then I should see the "<result>" after login

    Examples:
      | username | password   | result           |
      | testadmin | Admin@123# | Dashboard           |
      | testadmin | wrongpass  | Invalid credentials |
      |           | Admin@123# | Required            |
      | testadmin |            | Required            |
